import { reconcilePaymentById } from "./reconcile";
import type { Donation } from "@prisma/client";
import type { PaymentRepository, ReconciliationRepository, ReconciliationUpdate } from "./repository";
import type { YooKassaClient } from "./yookassa-client";

export const RECONCILIATION_POLICY = {
  limit: 25, maxAttempts: 8, maxAgeMs: 90 * 24 * 60 * 60 * 1_000,
  minimumAgeMs: 5 * 60_000, leaseMs: 60_000, budgetMs: 20_000,
} as const;

type BatchRepository = Pick<PaymentRepository,
  "listPendingForReconciliation" | "claimForReconciliation" | "updateReconciliation" |
  "findById" | "bindProviderPaymentId" | "transitionPending"
> & ReconciliationRepository;

export type ReconcilePendingInput = {
  repository: BatchRepository;
  client: Pick<YooKassaClient, "getPayment">;
  now: Date;
  limit: number;
  maxAttempts?: number;
  clock?: () => number;
};

export type ReconcilePendingResult = { succeeded: number; canceled: number; pending: number; failed: number; skipped: number };
const emptyResult = (): ReconcilePendingResult => ({ succeeded: 0, canceled: 0, pending: 0, failed: 0, skipped: 0 });
const backoff = (attempts: number) => Math.min(2 ** Math.min(16, Math.max(0, attempts - 1)) * 60_000, 3_600_000);

async function checkClaimed(input: ReconcilePendingInput, donation: Donation, token: string, now: Date, attempts: number) {
  const { repository, client } = input;
  const maxAttempts = input.maxAttempts ?? RECONCILIATION_POLICY.maxAttempts;
  try {
    const outcome = await reconcilePaymentById({
      paymentId: donation.providerPaymentId!, terminalEvent: null, expectedDonationId: donation.id,
    }, { client, repository });
    const terminal = outcome.kind === "succeeded" || outcome.kind === "canceled";
    const exhausted = !terminal && attempts >= maxAttempts;
    const permanent = outcome.kind === "permanent-rejection";
    const update: ReconciliationUpdate = {
      checkedAt: now, attempts,
      providerStatus: terminal || outcome.kind === "pending" ? outcome.kind : null,
      errorCode: permanent ? outcome.alertCode : exhausted ? "manual_review_required" : outcome.kind === "retry" ? outcome.code : outcome.kind === "pending" ? "payment_provider_pending" : null,
      nextReconcileAt: terminal || permanent || exhausted ? null : new Date(now.getTime() + backoff(attempts)),
      manualReviewRequired: permanent || exhausted,
    };
    await repository.updateReconciliation(donation.id, token, update);
    return terminal || outcome.kind === "pending" ? outcome.kind : "failed";
  } catch {
    await repository.updateReconciliation(donation.id, token, {
      checkedAt: now, providerStatus: null, errorCode: "payment_database_unavailable",
      nextReconcileAt: new Date(now.getTime() + backoff(attempts)), attempts,
      manualReviewRequired: attempts >= maxAttempts,
    }).catch(() => undefined);
    return "failed" as const;
  } finally {
    await repository.releaseReconciliation(donation.id, token).catch(() => undefined);
  }
}

export async function reconcilePendingPayments(input: ReconcilePendingInput): Promise<ReconcilePendingResult> {
  const { repository, now, limit, clock = Date.now, maxAttempts = RECONCILIATION_POLICY.maxAttempts } = input;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_batch_limit");
  const started = clock();
  const selection = {
    now, limit, maxAttempts,
    createdBefore: new Date(now.getTime() - RECONCILIATION_POLICY.minimumAgeMs),
    createdAfter: new Date(now.getTime() - RECONCILIATION_POLICY.maxAgeMs),
  };
  await repository.retireReconciliationCandidates(selection);
  const rows = await repository.listPendingForReconciliation(selection);
  const result = emptyResult();
  for (const [index, donation] of rows.entries()) {
    if (clock() - started >= RECONCILIATION_POLICY.budgetMs) { result.skipped += rows.length - index; break; }
    if (!donation.providerPaymentId) { result.skipped++; continue; }
    const current = new Date(now.getTime() + Math.max(0, clock() - started));
    const token = crypto.randomUUID();
    if (!await repository.claimForReconciliation(donation.id, token, new Date(current.getTime() + RECONCILIATION_POLICY.leaseMs), current)) {
      result.skipped++; continue;
    }
    const outcome = await checkClaimed(input, donation, token, current, donation.reconcileAttempts + 1);
    result[outcome]++;
  }
  return result;
}

export async function reconcileSinglePayment(input: Omit<ReconcilePendingInput, "limit"> & { donationId: string }) {
  const donation = await input.repository.findById(input.donationId);
  if (!donation) return { kind: "not-found" as const };
  if (!donation.providerPaymentId) return { kind: "unbound" as const };
  if (donation.status !== "PENDING") return { kind: "already-terminal" as const };
  const token = crypto.randomUUID();
  const claimed = await input.repository.claimManualReconciliation(donation.id, token, new Date(input.now.getTime() + RECONCILIATION_POLICY.leaseMs), input.now);
  if (!claimed) return { kind: "busy" as const };
  const kind = await checkClaimed({ ...input, limit: 1 }, donation, token, input.now, 1);
  return { kind };
}
