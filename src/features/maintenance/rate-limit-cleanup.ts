import { Prisma } from "@prisma/client";

type CleanupTransaction = Pick<Prisma.TransactionClient, "$executeRaw" | "$queryRaw">;
export type CleanupDatabase = {
  $transaction<T>(run: (tx: CleanupTransaction) => Promise<T>, options: { timeout: number }): Promise<T>;
};

/** One bounded pass. A full batch does not guarantee that more rows remain. */
export async function cleanupRateLimitBuckets(database: CleanupDatabase): Promise<{ deleted: number; batchFull: boolean }> {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
    // Prisma DateTime columns are UTC timestamps without a timezone.
    const [result] = await transaction.$queryRaw<{ deleted: number }[]>(Prisma.sql`
      WITH expired AS (
        SELECT "key", "windowStart"
        FROM "PaymentRateLimitBucket"
        WHERE "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        ORDER BY "expiresAt", "key", "windowStart"
        LIMIT 1000
        FOR UPDATE SKIP LOCKED
      ), deleted AS (
        DELETE FROM "PaymentRateLimitBucket" AS bucket
        USING expired
        WHERE bucket."key" = expired."key"
          AND bucket."windowStart" = expired."windowStart"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted FROM deleted
    `);
    return { deleted: result.deleted, batchFull: result.deleted === 1000 };
  }, { timeout: 5000 });
}
