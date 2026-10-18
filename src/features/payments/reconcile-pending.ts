import { reconcilePaymentById, type ReconcileOutcome } from "./reconcile";
import type { PaymentRepository } from "./repository";
import type { YooKassaClient } from "./yookassa-client";

const CLAIM_TTL_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60 * 1_000;

type BatchRepository = {
  [K in
    | "listPendingForReconciliation"
    | "claimForReconciliation"
    | "updateReconciliation"
    | "findById"
    | "bindProviderPaymentId"
    | "transitionPending"]: NonNullable<PaymentRepository[K]>;
};

export type ReconcilePendingInput = {
  repository: BatchRepository;
  client: Pick<YooKassaClient, "getPayment">;
  now: Date;
  limit: number;
  olderThan?: Date;
  maxAge?: Date;
  maxAttempts?: number;
};

export type ReconcilePendingResult = {
  succeeded: number;
  canceled: number;
  pending: number;
  failed: number;
  skipped: number;
};

function backoff(attempts: number) {
  return Math.min(2 ** Math.max(0, attempts - 1) * 60_000, MAX_BACKOFF_MS);
}

function retryCode(outcome: Extract<ReconcileOutcome, { kind: "retry" }>) {
  return outcome.code;
}

export async function reconcilePendingPayments({
  repository,
  client,
  now,
  limit,
  olderThan,
  maxAge,
  maxAttempts = 8,
}: ReconcilePendingInput): Promise<ReconcilePendingResult> {
  const rows = await repository.listPendingForReconciliation({
    now,
    limit: Math.max(1, Math.min(limit, 100)),
    olderThan,
  });
  const result: ReconcilePendingResult = {
    succeeded: 0,
    canceled: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
  };

  for (const donation of rows) {
    if (!donation.providerPaymentId || (maxAge && donation.createdAt < maxAge)) {
      result.skipped += 1;
      continue;
    }
    if (donation.reconcileAttempts >= maxAttempts) {
      result.skipped += 1;
      continue;
    }

    const token = crypto.randomUUID();
    const claimed = await repository.claimForReconciliation(
      donation.id,
      token,
      new Date(now.getTime() + CLAIM_TTL_MS),
      now,
    );
    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    try {
      const outcome = await reconcilePaymentById(
        { paymentId: donation.providerPaymentId, terminalEvent: null },
        { client, repository },
      );
      const attempts = donation.reconcileAttempts + 1;

      if (outcome.kind === "succeeded") {
        await repository.updateReconciliation(donation.id, token, {
          providerStatus: "succeeded",
          errorCode: null,
          nextReconcileAt: null,
          attempts,
        });
        result.succeeded += 1;
      } else if (outcome.kind === "canceled") {
        await repository.updateReconciliation(donation.id, token, {
          providerStatus: "canceled",
          errorCode: null,
          nextReconcileAt: null,
          attempts,
        });
        result.canceled += 1;
      } else if (outcome.kind === "pending") {
        await repository.updateReconciliation(donation.id, token, {
          providerStatus: "pending",
          errorCode: "payment_provider_pending",
          nextReconcileAt: new Date(now.getTime() + backoff(attempts)),
          attempts,
        });
        result.pending += 1;
      } else {
        await repository.updateReconciliation(donation.id, token, {
          providerStatus: null,
          errorCode:
            outcome.kind === "retry"
              ? retryCode(outcome)
              : "payment_reconcile_permanent_rejection",
          nextReconcileAt:
            outcome.kind === "retry"
              ? new Date(now.getTime() + backoff(attempts))
              : null,
          attempts,
          manualReviewRequired: outcome.kind === "permanent-rejection",
        });
        result.failed += 1;
      }
    } catch {
      await repository.updateReconciliation(donation.id, token, {
        providerStatus: null,
        errorCode: "payment_reconcile_database_unavailable",
        nextReconcileAt: new Date(now.getTime() + backoff(donation.reconcileAttempts + 1)),
        attempts: donation.reconcileAttempts + 1,
      }).catch(() => undefined);
      result.failed += 1;
    }
  }

  return result;
}
