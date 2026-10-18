import { describe, expect, it, vi } from "vitest";

import type { Donation } from "@prisma/client";

import { reconcilePendingPayments } from "./reconcile-pending";

const NOW = new Date("2026-10-19T10:00:00.000Z");

function donation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: "donation-1",
    providerPaymentId: "provider-1",
    idempotenceKey: "donation-1",
    amountKopecks: 10_000,
    currency: "RUB",
    status: "PENDING",
    donorName: null,
    donorEmail: "boston@example.org",
    paidAt: null,
    lastProviderStatus: null,
    lastReconciledAt: null,
    lastReconcileErrorCode: null,
    nextReconcileAt: null,
    reconcileAttempts: 0,
    claimToken: null,
    claimExpiresAt: null,
    manualReviewRequired: false,
    createdAt: NOW,
    updatedAt: NOW,
    projectId: null,
    ...overrides,
  };
}

function repositoryFixture() {
  const stored = donation();
  return {
    stored,
    repository: {
      listPendingForReconciliation: vi.fn(async () => [stored]),
      claimForReconciliation: vi.fn(async () => true),
      updateReconciliation: vi.fn(async () => undefined),
      findById: vi.fn(async () => stored),
      bindProviderPaymentId: vi.fn(async () => ({ kind: "existing" as const, donation: stored })),
      transitionPending: vi.fn(async (_id: string, status: "SUCCEEDED" | "CANCELED", paidAt: Date | null) => ({
        ...stored,
        status,
        paidAt,
      })),
    },
  };
}

describe("reconcilePendingPayments", () => {
  it("moves a successfully paid pending donation to succeeded", async () => {
    const fixture = repositoryFixture();
    const result = await reconcilePendingPayments({
      repository: fixture.repository,
      client: {
        getPayment: vi.fn(async () => ({
          id: "provider-1",
          status: "succeeded" as const,
          paid: true,
          capturedAt: "2026-10-19T10:01:00.000Z",
          amount: { kopecks: 10_000, currency: "RUB" },
          paymentMethod: { type: "sbp" as const },
          confirmation: undefined,
          metadata: { donationId: "donation-1" },
        })),
      },
      now: NOW,
      limit: 10,
    });

    expect(result).toMatchObject({ succeeded: 1, canceled: 0, pending: 0 });
    expect(fixture.repository.claimForReconciliation).toHaveBeenCalledOnce();
    expect(fixture.repository.transitionPending).toHaveBeenCalledWith(
      "donation-1",
      "SUCCEEDED",
      new Date("2026-10-19T10:01:00.000Z"),
    );
  });

  it("preserves pending and schedules a retry when the provider is still pending", async () => {
    const fixture = repositoryFixture();
    const result = await reconcilePendingPayments({
      repository: fixture.repository,
      client: {
        getPayment: vi.fn(async () => ({
          id: "provider-1",
          status: "pending" as const,
          paid: false,
          amount: { kopecks: 10_000, currency: "RUB" },
          paymentMethod: { type: "sbp" as const },
          confirmation: undefined,
          capturedAt: undefined,
          metadata: { donationId: "donation-1" },
        })),
      },
      now: NOW,
      limit: 10,
    });

    expect(result).toMatchObject({ succeeded: 0, canceled: 0, pending: 1 });
    expect(fixture.repository.updateReconciliation).toHaveBeenCalledWith(
      "donation-1",
      expect.any(String),
      expect.objectContaining({
        providerStatus: "pending",
        errorCode: "payment_provider_pending",
      }),
    );
  });
});
