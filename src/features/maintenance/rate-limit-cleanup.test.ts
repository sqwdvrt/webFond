import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { cleanupRateLimitBuckets, type CleanupDatabase } from "./rate-limit-cleanup";

describe("bounded rate-limit cleanup", () => {
  it.each([0, 17, 1000])("reports %i deleted rows without looping", async (deleted) => {
    const execute = vi.fn().mockResolvedValue(0);
    const query = vi.fn().mockResolvedValue([{ deleted }]);
    const transaction = vi.fn();
    const database: CleanupDatabase = {
      $transaction: async (run, options) => {
        transaction(run, options);
        return run({ $executeRaw: execute, $queryRaw: query });
      },
    };
    const result = await cleanupRateLimitBuckets(database);
    expect(result).toEqual({ deleted, batchFull: deleted === 1000 });
    expect(transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { timeout: 5000 });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].join("")).toBe("SET LOCAL statement_timeout = '2000ms'");
    expect(query).toHaveBeenCalledOnce();
    const sql = query.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql.sql).toContain('"windowStart" = expired."windowStart"');
    expect(sql.sql).toContain("LIMIT 1000");
    expect(sql.sql).toContain('"expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\')');
  });
  it("propagates database errors", async () => {
    await expect(cleanupRateLimitBuckets({ $transaction: vi.fn().mockRejectedValue(new Error("unavailable")) })).rejects.toThrow("unavailable");
  });
});
