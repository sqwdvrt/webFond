import type { Donation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { paymentAlertCodes } from "@/features/payments/alerts";
import { reconcileRetryCodes } from "@/features/payments/reconcile";

import { handlePaymentWebhook } from "./route";

const PAYMENT_ID = "provider-payment-1";
const BODY_LIMIT = 65_536;
const donation = {
  id: "f04d0001-0000-4000-8000-000000000001",
  providerPaymentId: PAYMENT_ID,
  idempotenceKey: "f04d0001-0000-4000-8000-000000000001",
  amountKopecks: 30_000,
  currency: "RUB",
  status: "SUCCEEDED",
  donorName: null,
  donorEmail: null,
  paidAt: new Date("2026-08-24T18:01:05.000Z"),
  createdAt: new Date("2026-08-24T18:00:00.000Z"),
  updatedAt: new Date("2026-08-24T18:01:05.000Z"),
  projectId: null,
} as Donation;

function privacy(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    type: "notification",
    event: "payment.succeeded",
    object: { id: PAYMENT_ID, extra: "must-be-ignored" },
    ...overrides,
  };
}

function request(body: unknown, init: RequestInit = {}) {
  return new Request("https://example.org/api/payments/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
    // @ts-expect-error Node Request duplex is required for streaming bodies.
    duplex: "half",
  });
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    reconcile: vi.fn(async () => ({
      kind: "succeeded" as const,
      donation,
    })),
    report: vi.fn(),
    ...overrides,
  };
}

describe("webhook envelope", () => {
  it("rejects Content-Length above 64 KiB", async () => {
    const deps = dependencies();
    const incoming = request(envelope(), {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(BODY_LIMIT + 1),
      },
    });
    const getReader = incoming.body
      ? vi.spyOn(incoming.body, "getReader")
      : undefined;

    const response = await handlePaymentWebhook(incoming, deps);

    expect(response.status).toBe(413);
    privacy(response);
    expect(getReader).not.toHaveBeenCalled();
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("cancels the stream after 65537 bytes", async () => {
    const deps = dependencies();
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(BODY_LIMIT));
        if (pulls > 1) {
          controller.enqueue(new Uint8Array(1).fill(7));
        }
      },
      cancel,
    });
    const incoming = new Request("https://example.org/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // @ts-expect-error Node Request duplex is required for streaming bodies.
      duplex: "half",
    });

    const response = await handlePaymentWebhook(incoming, deps);

    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const deps = dependencies();
    const response = await handlePaymentWebhook(request("{nope"), deps);

    expect(response.status).toBe(400);
    privacy(response);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("returns 200 without GET for a non-notification type", async () => {
    const deps = dependencies();
    const response = await handlePaymentWebhook(
      request(envelope({ type: "webhook" })),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("returns 200 without GET for an unsupported well-formed event", async () => {
    const deps = dependencies();
    const response = await handlePaymentWebhook(
      request(envelope({ event: "refund.succeeded" })),
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("returns 400 when object.id is missing", async () => {
    const deps = dependencies();
    const response = await handlePaymentWebhook(
      request(envelope({ object: {} })),
      deps,
    );

    expect(response.status).toBe(400);
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("passes only the event name and payment ID to reconcile", async () => {
    const deps = dependencies();

    await handlePaymentWebhook(request(envelope()), deps);

    expect(deps.reconcile).toHaveBeenCalledExactlyOnceWith(
      { paymentId: PAYMENT_ID, terminalEvent: "payment.succeeded" },
      expect.objectContaining({ report: deps.report }),
    );
  });
});

describe("webhook outcomes", () => {
  it.each([
    [{ kind: "succeeded", donation }, 200],
    [{ kind: "canceled", donation: { ...donation, status: "CANCELED" } }, 200],
    [
      {
        kind: "permanent-rejection",
        alertCode: paymentAlertCodes.localDonationMissing,
      },
      200,
    ],
  ] as const)("maps %j to %s", async (outcome, status) => {
    const deps = dependencies({
      reconcile: vi.fn(async () => outcome),
    });
    const response = await handlePaymentWebhook(request(envelope()), deps);

    expect(response.status).toBe(status);
    privacy(response);
  });

  it.each([
    reconcileRetryCodes.providerPending,
    reconcileRetryCodes.captureInvariant,
    reconcileRetryCodes.providerProtocol,
    reconcileRetryCodes.providerConfiguration,
    reconcileRetryCodes.providerUnavailable,
    reconcileRetryCodes.databaseUnavailable,
  ])("maps retry %s to 503", async (code) => {
    const deps = dependencies({
      reconcile: vi.fn(async () => ({ kind: "retry", code })),
    });
    const response = await handlePaymentWebhook(request(envelope()), deps);

    expect(response.status).toBe(503);
    privacy(response);
  });

  it("maps a database failure to 503", async () => {
    const deps = dependencies({
      reconcile: vi.fn(async () => {
        throw new Error("Prisma secret");
      }),
    });
    const response = await handlePaymentWebhook(request(envelope()), deps);

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.text())).not.toContain("Prisma");
  });

  it("reports only a fixed alert code without identifiers", async () => {
    const report = vi.fn();
    const deps = dependencies({
      report,
      reconcile: vi.fn(async (_input, { report: alert }) => {
        alert(paymentAlertCodes.amountMismatch);
        return {
          kind: "permanent-rejection",
          alertCode: paymentAlertCodes.amountMismatch,
        };
      }),
    });

    await handlePaymentWebhook(request(envelope()), deps);

    expect(report).toHaveBeenCalledExactlyOnceWith(
      paymentAlertCodes.amountMismatch,
    );
    expect(JSON.stringify(report.mock.calls)).not.toContain(PAYMENT_ID);
    expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
  });
});
