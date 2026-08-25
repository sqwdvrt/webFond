import type { Donation } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { reconcileRetryCodes } from "@/features/payments/reconcile";

import { AttemptCleanup } from "./attempt-cleanup";
import {
  dynamic,
  metadata,
  renderDonationResultPage,
} from "./page";

const DONATION_ID = "f04d0001-0000-4000-8000-000000000001";
const PROVIDER_ID = "provider-payment-1";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

function donation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: DONATION_ID,
    providerPaymentId: PROVIDER_ID,
    idempotenceKey: DONATION_ID,
    amountKopecks: 30_000,
    currency: "RUB",
    status: "PENDING",
    donorName: null,
    donorEmail: null,
    paidAt: null,
    createdAt: new Date("2026-08-24T18:00:00.000Z"),
    updatedAt: new Date("2026-08-24T18:00:00.000Z"),
    ...overrides,
  };
}

function params(donationId?: string) {
  return Promise.resolve(donationId ? { donation: donationId } : {});
}

describe("donation result page", () => {
  it("calls notFound for a missing or unknown donation id", async () => {
    const findById = vi.fn(async () => null);
    await expect(
      renderDonationResultPage(params(), { findById, reconcile: vi.fn() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      renderDonationResultPage(params(DONATION_ID), {
        findById,
        reconcile: vi.fn(),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findById).toHaveBeenCalledExactlyOnceWith(DONATION_ID);
  });

  it("reconciles every record that already has a provider payment id", async () => {
    const stored = donation({ status: "SUCCEEDED" });
    const reconcile = vi.fn(async () => ({
      kind: "succeeded" as const,
      donation: stored,
    }));

    render(
      await renderDonationResultPage(params(DONATION_ID), {
        findById: async () => stored,
        reconcile,
      }),
    );

    expect(reconcile).toHaveBeenCalledExactlyOnceWith({
      paymentId: PROVIDER_ID,
      terminalEvent: null,
    });
    expect(screen.getByRole("heading", { name: /спасибо/i })).toBeVisible();
    expect(screen.getByTestId("attempt-cleanup")).toHaveAttribute(
      "data-donation-id",
      DONATION_ID,
    );
  });

  it("shows canceled and pending states", async () => {
    const canceled = donation({ status: "CANCELED", paidAt: null });
    const canceledView = render(
      await renderDonationResultPage(params(DONATION_ID), {
        findById: async () => canceled,
        reconcile: async () => ({ kind: "canceled", donation: canceled }),
      }),
    );
    expect(screen.getByRole("link", { name: /повторить/i })).toHaveAttribute(
      "href",
      "/help",
    );
    canceledView.unmount();

    const pending = donation();
    const pendingView = render(
      await renderDonationResultPage(params(DONATION_ID), {
        findById: async () => pending,
        reconcile: async () => ({
          kind: "pending",
          donation: pending,
          confirmationUrl: "https://yoomoney.ru/checkout/payment",
        }),
      }),
    );
    expect(screen.getByText(/обрабатывается/i)).toBeVisible();
    expect(screen.queryByTestId("attempt-cleanup")).toBeNull();
    pendingView.unmount();
  });

  it("keeps an unbound pending donation without calling the provider", async () => {
    const stored = donation({ providerPaymentId: null });
    const reconcile = vi.fn();
    render(
      await renderDonationResultPage(params(DONATION_ID), {
        findById: async () => stored,
        reconcile,
      }),
    );
    expect(reconcile).not.toHaveBeenCalled();
    expect(screen.getByText(/обрабатывается/i)).toBeVisible();
  });

  it("shows a technical error instead of ordinary pending when GET is retryable", async () => {
    render(
      await renderDonationResultPage(params(DONATION_ID), {
        findById: async () => donation(),
        reconcile: async () => ({
          kind: "retry",
          code: reconcileRetryCodes.providerUnavailable,
        }),
      }),
    );
    expect(screen.getByRole("heading", { name: /не удалось проверить/i })).toBeVisible();
    expect(screen.queryByText(/обрабатывается/i)).toBeNull();
  });

  it("does not accept an idempotence key in result components", () => {
    const source = [
      readFileSync(join(process.cwd(), "src/app/donation/result/page.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/app/donation/result/result-view.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/app/donation/result/attempt-cleanup.tsx"), "utf8"),
    ].join("\n");
    expect(source).not.toContain("idempotenceKey");
  });

  it("is dynamic, noindex, and not in the sitemap source", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");
    const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(sitemap).not.toContain("/donation/result");
    expect(nextConfig).toContain('source: "/donation/result"');
    expect(nextConfig).toContain("private, no-store, max-age=0");
  });
});

describe("AttemptCleanup", () => {
  it("clears only a matching stored donation marker", () => {
    sessionStorage.setItem(
      "byt-dobru.paymentAttempt.v1",
      JSON.stringify({
        version: 1,
        id: DONATION_ID,
        amountRoubles: 300,
        createdAt: new Date().toISOString(),
        donationId: DONATION_ID,
      }),
    );
    render(<AttemptCleanup donationId={DONATION_ID} />);
    expect(sessionStorage.getItem("byt-dobru.paymentAttempt.v1")).toBeNull();

    sessionStorage.setItem(
      "byt-dobru.paymentAttempt.v1",
      JSON.stringify({
        version: 1,
        id: "other",
        amountRoubles: 500,
        createdAt: new Date().toISOString(),
        donationId: "other-donation",
      }),
    );
    render(<AttemptCleanup donationId={DONATION_ID} />);
    expect(sessionStorage.getItem("byt-dobru.paymentAttempt.v1")).toContain(
      "other-donation",
    );
  });
});
