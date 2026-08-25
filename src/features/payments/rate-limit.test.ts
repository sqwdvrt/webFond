import { describe, expect, it, vi } from "vitest";

import {
  PaymentRateLimitedError,
  consumeBucket,
  paymentLimitKeys,
} from "./rate-limit";

type RawCall = {
  strings: readonly string[];
  values: unknown[];
};

function transactionReturning(count: number) {
  const calls: RawCall[] = [];
  const tx = {
    $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      calls.push({ strings: [...strings], values });
      return Promise.resolve([{ count }]);
    },
  };

  return { calls, tx };
}

describe("paymentLimitKeys", () => {
  it("returns stable keys for every client and global scope", () => {
    expect(paymentLimitKeys("hashed-client-17")).toEqual({
      clientRequests: "client:requests:10m:hashed-client-17",
      clientAttempts: "client:attempts:10m:hashed-client-17",
      globalRequests: "global:requests:1m",
      globalAttempts: "global:attempts:1m",
    });
  });
});

describe("consumeBucket", () => {
  it.each([
    {
      now: new Date("2026-08-24T20:39:59.999Z"),
      windowMs: 10 * 60 * 1_000,
      expectedStart: new Date("2026-08-24T20:30:00.000Z"),
      expectedExpiry: new Date("2026-08-24T20:40:00.000Z"),
    },
    {
      now: new Date("2026-08-24T20:40:00.000Z"),
      windowMs: 10 * 60 * 1_000,
      expectedStart: new Date("2026-08-24T20:40:00.000Z"),
      expectedExpiry: new Date("2026-08-24T20:50:00.000Z"),
    },
    {
      now: new Date("2026-08-24T20:40:00.000Z"),
      windowMs: 60 * 1_000,
      expectedStart: new Date("2026-08-24T20:40:00.000Z"),
      expectedExpiry: new Date("2026-08-24T20:41:00.000Z"),
    },
  ])(
    "uses fixed UTC window boundaries for $windowMs ms",
    async ({ now, windowMs, expectedStart, expectedExpiry }) => {
      const { calls, tx } = transactionReturning(1);

      await consumeBucket(tx, {
        key: "payments:test",
        now,
        windowMs,
        limit: 20,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].values).toEqual([
        "payments:test",
        expectedStart,
        expectedExpiry,
      ]);
      expect(calls[0].strings.join("")).toContain("AT TIME ZONE 'UTC'");
    },
  );

  it("accepts the request whose count reaches the limit", async () => {
    const { tx } = transactionReturning(20);

    await expect(
      consumeBucket(tx, {
        key: "payments:test",
        now: new Date("2026-08-24T20:40:00.000Z"),
        windowMs: 10 * 60 * 1_000,
        limit: 20,
      }),
    ).resolves.toBeUndefined();
  });

  it("throws a typed error with exact positive Retry-After above the limit", async () => {
    const { tx } = transactionReturning(21);

    const error = await consumeBucket(tx, {
      key: "payments:test",
      now: new Date("2026-08-24T20:49:59.001Z"),
      windowMs: 10 * 60 * 1_000,
      limit: 20,
    }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(PaymentRateLimitedError);
    expect(error).toMatchObject({ retryAfterSeconds: 1 });
  });

  it("keeps SQL data parameterized", async () => {
    const marker = "malicious'); DROP TABLE Donation; --";
    const { calls, tx } = transactionReturning(1);

    await consumeBucket(tx, {
      key: marker,
      now: new Date("2026-08-24T20:40:00.000Z"),
      windowMs: 60 * 1_000,
      limit: 300,
    });

    const sqlText = calls[0].strings.join("");
    expect(sqlText).not.toContain(marker);
    expect(calls[0].values).toContain(marker);
    expect(sqlText).toContain('ON CONFLICT ("key", "windowStart")');
    expect(sqlText).toContain('RETURNING "count"');
  });

  it("surfaces database errors", async () => {
    const failure = new Error("database unavailable");
    const tx = {
      $queryRaw: vi.fn().mockRejectedValue(failure),
    };

    await expect(
      consumeBucket(tx, {
        key: "payments:test",
        now: new Date("2026-08-24T20:40:00.000Z"),
        windowMs: 60 * 1_000,
        limit: 300,
      }),
    ).rejects.toBe(failure);
  });
});
