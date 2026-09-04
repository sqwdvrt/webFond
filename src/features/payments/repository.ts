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
): PaymentRepository {
  return {
    async beginAttempt({
      attemptId,
      amountKopecks,
      customerEmail,
      clientKey,
      now,
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
              existing.donorEmail !== customerEmail
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
