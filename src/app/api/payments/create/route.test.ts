import { describe, expect, it, vi } from "vitest";

import { PaymentsConfigurationError } from "@/features/payments/config";
import type { PaymentCreateConfig } from "@/features/payments/types";

import { handlePaymentCreate } from "./route";

const ATTEMPT_ID = "f04d0001-0000-4000-8000-000000000001";
const SITE_ORIGIN = "https://example.org";
const BODY_LIMIT = 8192;

const validBody = {
  amountRoubles: 300,
  acceptedOffer: true,
  acceptedPersonalData: true,
  attemptId: ATTEMPT_ID,
  website: "",
};

const config: PaymentCreateConfig = {
  shopId: "shop-id",
  secretKey: "secret-key",
  siteUrl: new URL(SITE_ORIGIN),
  returnUrl: new URL(`${SITE_ORIGIN}/donation/result`),
  rateLimitSecret: "payment-rate-limit-secret-key-32",
  trustProxy: true,
};

function privacyHeaders(response: Response) {
  return {
    cache: response.headers.get("Cache-Control"),
    referrer: response.headers.get("Referrer-Policy"),
    sniff: response.headers.get("X-Content-Type-Options"),
  };
}

function expectPrivacy(response: Response) {
  expect(privacyHeaders(response)).toEqual({
    cache: "no-store",
    referrer: "no-referrer",
    sniff: "nosniff",
  });
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    readConfig: vi.fn(() => config),
    createClientKey: vi.fn(() => "client-key"),
    createPayment: vi.fn(async () => ({
      kind: "redirect" as const,
      url: "https://yoomoney.ru/checkout/payment",
      donationId: ATTEMPT_ID,
    })),
    now: () => new Date("2026-08-24T18:00:00.000Z"),
    environment: "test",
    reportConfigError: vi.fn(),
    ...overrides,
  };
}

function request(init: {
  origin?: string | null;
  contentType?: string;
  contentLength?: string;
  body?: BodyInit | null;
  extraHeaders?: HeadersInit;
} = {}) {
  const headers = new Headers(init.extraHeaders);
  if (init.origin !== null) {
    headers.set("Origin", init.origin ?? SITE_ORIGIN);
  }
  headers.set("Content-Type", init.contentType ?? "application/json");
  if (init.contentLength !== undefined) {
    headers.set("Content-Length", init.contentLength);
  }

  return new Request(`${SITE_ORIGIN}/api/payments/create`, {
    method: "POST",
    headers,
    body: init.body ?? JSON.stringify(validBody),
    // @ts-expect-error Node Request duplex is required for streaming bodies.
    duplex: "half",
  });
}

describe("payment create HTTP guards", () => {
  it("rejects Content-Length above 8 KiB before reading the body", async () => {
    const deps = dependencies();
    const incoming = request({
      contentLength: String(BODY_LIMIT + 1),
      body: JSON.stringify(validBody),
    });
    const text = vi.spyOn(incoming, "text");
    const getReader = incoming.body
      ? vi.spyOn(incoming.body, "getReader")
      : undefined;

    const response = await handlePaymentCreate(incoming, deps);

    expect(response.status).toBe(413);
    expectPrivacy(response);
    expect(text).not.toHaveBeenCalled();
    expect(getReader).not.toHaveBeenCalled();
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("rejects a body larger than 8 KiB and cancels leftover chunks", async () => {
    const deps = dependencies();
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(BODY_LIMIT));
        if (pulls > 1) {
          controller.enqueue(new Uint8Array(8).fill(7));
        }
      },
      cancel,
    });

    const response = await handlePaymentCreate(
      request({ body, contentLength: undefined }),
      deps,
    );

    expect(response.status).toBe(413);
    expectPrivacy(response);
    expect(cancel).toHaveBeenCalledOnce();
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type before reading the body", async () => {
    const deps = dependencies();
    const incoming = request({
      contentType: "text/plain",
      body: JSON.stringify(validBody),
    });
    const text = vi.spyOn(incoming, "text");
    const getReader = incoming.body
      ? vi.spyOn(incoming.body, "getReader")
      : undefined;

    const response = await handlePaymentCreate(incoming, deps);

    expect(response.status).toBe(415);
    expectPrivacy(response);
    expect(text).not.toHaveBeenCalled();
    expect(getReader).not.toHaveBeenCalled();
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it.each([undefined, "https://evil.example"])(
    "rejects a missing or foreign Origin: %s",
    async (origin) => {
      const deps = dependencies();
      const response = await handlePaymentCreate(
        request({ origin: origin ?? null }),
        deps,
      );

      expect(response.status).toBe(403);
      expectPrivacy(response);
      expect(deps.createPayment).not.toHaveBeenCalled();
      expect(deps.readConfig).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for malformed JSON without calling create", async () => {
    const deps = dependencies();
    const response = await handlePaymentCreate(
      request({ body: "{not json" }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expectPrivacy(response);
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid fields without calling create", async () => {
    const deps = dependencies();
    const response = await handlePaymentCreate(
      request({ body: JSON.stringify({ ...validBody, amountRoubles: 1 }) }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("returns empty 204 for a filled honeypot without touching payments", async () => {
    const deps = dependencies();
    const response = await handlePaymentCreate(
      request({
        body: JSON.stringify({ ...validBody, website: "https://spam.test" }),
      }),
      deps,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expectPrivacy(response);
    expect(deps.readConfig).not.toHaveBeenCalled();
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("returns 503 when the payment gate is disabled", async () => {
    const deps = dependencies({
      readConfig: vi.fn(() => {
        throw new PaymentsConfigurationError("payments-disabled");
      }),
    });

    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "configuration_unavailable",
    });
    expectPrivacy(response);
    expect(deps.createPayment).not.toHaveBeenCalled();
    expect(deps.reportConfigError).toHaveBeenCalledExactlyOnceWith(
      "payments-disabled",
    );
  });

  it("hashes the client key from request headers before create", async () => {
    const deps = dependencies();
    const incoming = request({
      extraHeaders: { "x-forwarded-for": "192.0.2.10" },
    });

    await handlePaymentCreate(incoming, deps);

    expect(deps.createClientKey).toHaveBeenCalledExactlyOnceWith({
      headers: incoming.headers,
      secret: config.rateLimitSecret,
      trustProxy: true,
      environment: "test",
    });
    expect(deps.createPayment).toHaveBeenCalledExactlyOnceWith(
      {
        amountKopecks: 30_000,
        attemptId: ATTEMPT_ID,
        clientKey: "client-key",
      },
      expect.objectContaining({ config }),
    );
  });
});

describe("payment create outcome mapping", () => {
  it("returns 200 with the redirect URL", async () => {
    const deps = dependencies();
    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      redirectUrl: "https://yoomoney.ru/checkout/payment",
      donationId: ATTEMPT_ID,
    });
    expectPrivacy(response);
  });

  it("returns 200 with a local result URL", async () => {
    const deps = dependencies({
      createPayment: vi.fn(async () => ({
        kind: "result",
        url: `${SITE_ORIGIN}/donation/result?donation=${ATTEMPT_ID}`,
        donationId: ATTEMPT_ID,
      })),
    });
    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      redirectUrl: `${SITE_ORIGIN}/donation/result?donation=${ATTEMPT_ID}`,
      donationId: ATTEMPT_ID,
    });
  });

  it("returns 429 with integer Retry-After", async () => {
    const deps = dependencies({
      createPayment: vi.fn(async () => ({
        kind: "rate-limited",
        retryAfterSeconds: 42,
      })),
    });
    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({ error: "rate_limited" });
  });

  it.each([
    ["stale-attempt", 409, "stale_attempt"],
    ["conflict", 409, "conflict"],
    ["provider-rejected", 502, "provider_rejected"],
    ["configuration-unavailable", 503, "configuration_unavailable"],
    ["provider-endpoint-error", 502, "provider_endpoint_error"],
    ["provider-unavailable", 503, "provider_unavailable"],
    ["protocol-error", 502, "provider_protocol"],
  ] as const)("maps %s to %s", async (kind, status, error) => {
    const deps = dependencies({
      createPayment: vi.fn(async () => ({ kind })),
    });
    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expectPrivacy(response);
  });

  it("returns 500 for an unknown error without leaking details", async () => {
    const deps = dependencies({
      createPayment: vi.fn(async () => {
        throw new Error("Prisma secret details");
      }),
    });
    const response = await handlePaymentCreate(request(), deps);

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toEqual({ error: "internal_error" });
    expect(JSON.stringify(payload)).not.toContain("Prisma");
    expectPrivacy(response);
  });
});
