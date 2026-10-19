import type { Donation, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";

import { consumeBucket, paymentLimitKeys } from "./rate-limit";

const CLIENT_WINDOW_MS = 10 * 60 * 1_000;
const GLOBAL_WINDOW_MS = 60 * 1_000;

type PaymentClient = Pick<
  PrismaClient,
  "$transaction" | "donation" | "paymentRateLimitBucket"
>;

type BeginAttemptInput = {
  attemptId: string;
  amountKopecks: number;
  customerEmail: string;
  clientKey: string;
  now: Date;
  projectId?: string | null;
};

type BeginAttemptResult =
  | { kind: "created"; donation: Donation }
  | { kind: "existing"; donation: Donation };

type BeginAttemptTransactionResult =
  | BeginAttemptResult
  | { kind: "conflict" };

type BindProviderPaymentIdResult =
  | { kind: "bound"; donation: Donation }
  | { kind: "existing"; donation: Donation }
  | { kind: "conflict"; donation: Donation | null };

type PendingTransition =
  | [status: "SUCCEEDED", paidAt: Date]
  | [status: "CANCELED", paidAt: null];

export type ReconciliationCandidate = Donation;

export type ReconciliationUpdate = {
  providerStatus: string | null;
  errorCode: string | null;
  nextReconcileAt: Date | null;
  attempts: number;
  manualReviewRequired?: boolean;
  checkedAt?: Date;
};

export type ReconciliationSelection = {
  now: Date;
  limit: number;
  createdBefore?: Date;
  createdAfter?: Date;
  maxAttempts?: number;
};

export type ReconciliationRepository = {
  retireReconciliationCandidates(input: ReconciliationSelection): Promise<void>;
  releaseReconciliation(id: string, token: string): Promise<void>;
  claimManualReconciliation(id: string, token: string, expiresAt: Date, now: Date): Promise<boolean>;
};

export type PaymentRepository = {
  beginAttempt(input: BeginAttemptInput): Promise<BeginAttemptResult>;
  findById(id: string): Promise<Donation | null>;
  findByProviderPaymentId(providerPaymentId: string): Promise<Donation | null>;
  bindProviderPaymentId(
    id: string,
    providerPaymentId: string,
  ): Promise<BindProviderPaymentIdResult>;
  transitionPending(
    id: string,
    ...transition: PendingTransition
  ): Promise<Donation>;
  listPendingForReconciliation(input: ReconciliationSelection): Promise<ReconciliationCandidate[]>;
  claimForReconciliation(id: string, token: string, expiresAt: Date, now: Date): Promise<boolean>;
  updateReconciliation(id: string, token: string, update: ReconciliationUpdate): Promise<void>;
  clearManualReview(id: string): Promise<void>;
  deleteUnboundPending(id: string): Promise<boolean>;
};

export class PaymentAttemptConflictError extends Error {
  constructor() {
    super("Payment attempt conflicts with an existing donation");
    this.name = "PaymentAttemptConflictError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export function createPaymentRepository(
  client: PaymentClient,
): PaymentRepository & ReconciliationRepository {
  return {
    async beginAttempt({
      attemptId,
      amountKopecks,
      customerEmail,
      clientKey,
      now,
      projectId = null,
    }: BeginAttemptInput): Promise<BeginAttemptResult> {
      const keys = paymentLimitKeys(clientKey);
      const result: BeginAttemptTransactionResult = await client.$transaction(
        async (tx) => {
          await consumeBucket(tx, {
            key: keys.clientRequests,
            now,
            windowMs: CLIENT_WINDOW_MS,
            limit: 20,
          });
          await consumeBucket(tx, {
            key: keys.globalRequests,
            now,
            windowMs: GLOBAL_WINDOW_MS,
            limit: 300,
          });
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${attemptId}, 0))
          `;

          const existing = await tx.donation.findUnique({
            where: { id: attemptId },
          });
          if (existing) {
            if (
              existing.amountKopecks !== amountKopecks ||
              existing.currency !== "RUB" ||
              existing.donorEmail !== customerEmail ||
              existing.projectId !== projectId
            ) {
              return { kind: "conflict" as const };
            }

            return { kind: "existing" as const, donation: existing };
          }

          await consumeBucket(tx, {
            key: keys.clientAttempts,
            now,
            windowMs: CLIENT_WINDOW_MS,
            limit: 5,
          });
          await consumeBucket(tx, {
            key: keys.globalAttempts,
            now,
            windowMs: GLOBAL_WINDOW_MS,
            limit: 100,
          });

          const created = await tx.donation.create({
            data: {
              id: attemptId,
              idempotenceKey: attemptId,
              amountKopecks,
              currency: "RUB",
              status: "PENDING",
              donorEmail: customerEmail,
              projectId,
            },
          });
          return { kind: "created" as const, donation: created };
        },
      );

      await client.paymentRateLimitBucket
        .deleteMany({ where: { expiresAt: { lte: now } } })
        .catch(() => undefined);

      if (result.kind === "conflict") {
        throw new PaymentAttemptConflictError();
      }

      return result;
    },

    findById(id: string) {
      return client.donation.findUnique({ where: { id } });
    },

    findByProviderPaymentId(providerPaymentId: string) {
      return client.donation.findUnique({ where: { providerPaymentId } });
    },

    async bindProviderPaymentId(
      id: string,
      providerPaymentId: string,
    ): Promise<BindProviderPaymentIdResult> {
      try {
        const update = await client.donation.updateMany({
          where: { id, providerPaymentId: null },
          data: { providerPaymentId },
        });
        const stored = await client.donation.findUnique({ where: { id } });

        if (update.count === 1 && stored) {
          return { kind: "bound", donation: stored };
        }
        if (stored?.providerPaymentId === providerPaymentId) {
          return { kind: "existing", donation: stored };
        }
        return { kind: "conflict", donation: stored };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const stored = await client.donation.findUnique({ where: { id } });
        return { kind: "conflict", donation: stored };
      }
    },

    async transitionPending(
      id: string,
      ...[status, paidAt]: PendingTransition
    ): Promise<Donation> {
      await client.donation.updateMany({
        where: { id, status: "PENDING" },
        data: { status, paidAt },
      });
      return client.donation.findUniqueOrThrow({ where: { id } });
    },

    listPendingForReconciliation({ now, limit, createdBefore, createdAfter, maxAttempts = 8 }) {
      return client.donation.findMany({
        where: {
          status: "PENDING",
          providerPaymentId: { not: null },
          manualReviewRequired: false,
          reconcileAttempts: { lt: maxAttempts },
          createdAt: { ...(createdBefore ? { lte: createdBefore } : {}), ...(createdAfter ? { gte: createdAfter } : {}) },
          AND: [
            { OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }] },
            { OR: [{ claimToken: null }, { claimExpiresAt: { lte: now } }] },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit,
      });
    },

    async retireReconciliationCandidates({ now, limit, createdAfter, maxAttempts = 8 }) {
      const rows = await client.donation.findMany({
        where: {
          status: "PENDING", manualReviewRequired: false, providerPaymentId: { not: null },
          AND: [
            { OR: [{ reconcileAttempts: { gte: maxAttempts } }, ...(createdAfter ? [{ createdAt: { lt: createdAfter } }] : [])] },
            { OR: [{ claimToken: null }, { claimExpiresAt: { lte: now } }] },
          ],
        },
        select: { id: true }, take: limit, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      for (const row of rows) {
        await client.donation.updateMany({
          where: {
            id: row.id, status: "PENDING",
            AND: [
              { OR: [{ claimToken: null }, { claimExpiresAt: { lte: now } }] },
              { OR: [{ reconcileAttempts: { gte: maxAttempts } }, ...(createdAfter ? [{ createdAt: { lt: createdAfter } }] : [])] },
            ],
          },
          data: { manualReviewRequired: true, lastReconcileErrorCode: "manual_review_required", nextReconcileAt: null },
        });
      }
    },

    async claimManualReconciliation(id, token, expiresAt, now) {
      return client.$transaction(async (tx) => {
        const result = await tx.donation.updateMany({
          where: { id, status: "PENDING", providerPaymentId: { not: null }, OR: [{ claimToken: null }, { claimExpiresAt: { lte: now } }] },
          data: { claimToken: token, claimExpiresAt: expiresAt, manualReviewRequired: false, reconcileAttempts: 0, nextReconcileAt: null },
        });
        if (result.count === 1) await tx.adminAuditEvent.create({ data: { actorKind: "ADMIN", action: "PAYMENT_RECONCILE_REQUESTED", entityType: "DONATION", entityId: id } });
        return result.count === 1;
      });
    },

    async releaseReconciliation(id, token) {
      await client.donation.updateMany({ where: { id, claimToken: token }, data: { claimToken: null, claimExpiresAt: null } });
    },

    async claimForReconciliation(id, token, expiresAt, now) {
      const result = await client.donation.updateMany({
        where: {
          id,
          status: "PENDING",
          manualReviewRequired: false,
          AND: [
            { OR: [{ claimToken: null }, { claimExpiresAt: { lte: now } }] },
            { OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }] },
          ],
        },
        data: { claimToken: token, claimExpiresAt: expiresAt },
      });
      return result.count === 1;
    },

    async updateReconciliation(id, token, update) {
      await client.donation.updateMany({
        where: { id, claimToken: token },
        data: {
          lastProviderStatus: update.providerStatus,
          lastReconciledAt: update.checkedAt ?? new Date(),
          lastReconcileErrorCode: update.errorCode,
          nextReconcileAt: update.nextReconcileAt,
          reconcileAttempts: update.attempts,
          manualReviewRequired: update.manualReviewRequired ?? false,
          claimToken: null,
          claimExpiresAt: null,
        },
      });
    },

    async clearManualReview(id) {
      await client.donation.updateMany({
        where: { id },
        data: {
          manualReviewRequired: false,
          reconcileAttempts: 0,
          lastReconcileErrorCode: null,
          nextReconcileAt: null,
        },
      });
    },

    async deleteUnboundPending(id: string): Promise<boolean> {
      const result = await client.donation.deleteMany({
        where: {
          id,
          status: "PENDING",
          providerPaymentId: null,
        },
      });
      return result.count === 1;
    },
  };
}

export const paymentRepository = createPaymentRepository(prisma);

export async function consumeReconciliationQuota(now: Date, auditBatch = false) {
  await prisma.$transaction(async (tx) => {
    await consumeBucket(tx, { key: "admin:reconciliation:1m", now, windowMs: 60_000, limit: 20 });
    if (auditBatch) await tx.adminAuditEvent.create({ data: { actorKind: "ADMIN", action: "PAYMENT_RECONCILE_REQUESTED", entityType: "DONATION", entityId: "batch" } });
  });
}
