// @vitest-environment node
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupRateLimitBuckets, type CleanupDatabase } from "./rate-limit-cleanup";

const databaseUrl = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL;
const schema = `rate_limit_cleanup_${randomUUID().replaceAll("-", "")}`;
const describeDatabase = databaseUrl ? describe : describe.skip;

// Validate before creating any client or performing any database operation.
function validatedConnection(value: string) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1"].includes(url.hostname)
    || !decodeURIComponent(url.pathname.slice(1)).endsWith("_test")) {
    throw new Error("Rate-limit integration requires local PostgreSQL and a database ending _test");
  }
  url.search = "";
  return url;
}

describeDatabase("bounded rate-limit cleanup PostgreSQL integration", () => {
  let admin: PrismaClient | undefined;
  let first: PrismaClient;
  let second: PrismaClient;
  let schemaCreated = false;

  beforeAll(async () => {
    const url = validatedConnection(databaseUrl!);
    admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    url.searchParams.set("schema", schema);
    first = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    second = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    // Equivalent to the Prisma model; no extensions or shared-schema migrations.
    await first.$executeRawUnsafe(`CREATE TABLE "PaymentRateLimitBucket" (
      "key" TEXT NOT NULL, "windowStart" TIMESTAMP(3) NOT NULL,
      "count" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
      PRIMARY KEY ("key", "windowStart")
    )`);
    await first.$executeRawUnsafe('CREATE INDEX "PaymentRateLimitBucket_expiresAt_idx" ON "PaymentRateLimitBucket" ("expiresAt")');
  });

  afterAll(async () => {
    try {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
    } finally {
      try {
        if (schemaCreated) await admin!.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin?.$disconnect();
      }
    }
  });

  async function seed() {
    await first.paymentRateLimitBucket.deleteMany();
    await first.$executeRaw`
      INSERT INTO "PaymentRateLimitBucket" ("key", "windowStart", "count", "expiresAt")
      SELECT 'key-' || i, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '2 hours', 1,
             (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 hour'
      FROM generate_series(1, 2505) AS i
    `;
    // Same key as an expired row, but a different (active) compound key.
    await first.paymentRateLimitBucket.createMany({ data: [
      { key: "key-1", windowStart: new Date(), count: 8, expiresAt: new Date(Date.now() + 3600_000) },
      { key: "active-2", windowStart: new Date(), count: 4, expiresAt: new Date(Date.now() + 3600_000) },
    ] });
  }

  async function expectOnlyActiveRows() {
    const rows = await first.paymentRateLimitBucket.findMany({ orderBy: { key: "asc" } });
    expect(rows.map(({ key, count }) => ({ key, count }))).toEqual([
      { key: "active-2", count: 4 }, { key: "key-1", count: 8 },
    ]);
  }

  it("drains more than a batch in bounded passes, retains active compound keys, and is idempotent", async () => {
    await seed();
    const nonUtcDatabase: CleanupDatabase = {
      $transaction: (run, options) => first.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL TIME ZONE 'Europe/Moscow'`;
        return run(tx);
      }, options),
    };
    expect(await cleanupRateLimitBuckets(nonUtcDatabase)).toEqual({ deleted: 1000, batchFull: true });
    expect(await first.paymentRateLimitBucket.count()).toBe(1507);
    expect(await cleanupRateLimitBuckets(first)).toEqual({ deleted: 1000, batchFull: true });
    expect(await cleanupRateLimitBuckets(nonUtcDatabase)).toEqual({ deleted: 505, batchFull: false });
    expect(await cleanupRateLimitBuckets(first)).toEqual({ deleted: 0, batchFull: false });
    expect(await cleanupRateLimitBuckets(first)).toEqual({ deleted: 0, batchFull: false });
    await expectOnlyActiveRows();
  });

  it("skips another client's uncommitted locked batch and deletes disjoint rows", async () => {
    await seed();
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const holdingDatabase: CleanupDatabase = {
      $transaction: (run, options) => first.$transaction(async (tx) => {
        const result = await run(tx);
        locked();
        await held;
        return result;
      }, options),
    };
    const pending = cleanupRateLimitBuckets(holdingDatabase);
    // Any first-transaction failure also rejects this wait, avoiding a hung test.
    try {
      await Promise.race([ready, pending]);
      const concurrent = await cleanupRateLimitBuckets(second);
      expect(concurrent).toEqual({ deleted: 1000, batchFull: true });
      release();
      expect(await pending).toEqual({ deleted: 1000, batchFull: true });
    } finally {
      release();
      await pending;
    }
    // Two full batches removed 2000 distinct rows; no overlap or double counting.
    expect(await first.paymentRateLimitBucket.count()).toBe(507);
    expect(await cleanupRateLimitBuckets(second)).toEqual({ deleted: 505, batchFull: false });
    expect(await cleanupRateLimitBuckets(first)).toEqual({ deleted: 0, batchFull: false });
    await expectOnlyActiveRows();
  });
});
