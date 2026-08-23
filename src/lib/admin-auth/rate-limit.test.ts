import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modulePath = resolve(process.cwd(), "src/lib/admin-auth/rate-limit.ts");

async function createLimiter(options?: {
  maxAttempts?: number;
  windowMs?: number;
  blockMs?: number;
  maxEntries?: number;
}) {
  expect(existsSync(modulePath)).toBe(true);
  const importPath = "./rate-limit";
  const { LoginAttemptLimiter } = (await import(
    /* @vite-ignore */ importPath
  )) as typeof import("./rate-limit");
  return new LoginAttemptLimiter(options);
}

describe("LoginAttemptLimiter", () => {
  it("blocks after five failures for fifteen minutes", async () => {
    const limiter = await createLimiter();
    const start = 1_000_000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.check("client", start + attempt)).toEqual({
        allowed: true,
      });
      limiter.recordFailure("client", start + attempt);
    }

    expect(limiter.check("client", start + 5)).toEqual({ allowed: false });
    expect(limiter.check("client", start + 15 * 60_000 - 1)).toEqual({
      allowed: false,
    });
    expect(limiter.check("client", start + 15 * 60_000 + 4)).toEqual({
      allowed: true,
    });
  });

  it("drops failures outside the attempt window", async () => {
    const limiter = await createLimiter({
      maxAttempts: 2,
      windowMs: 100,
      blockMs: 100,
    });

    limiter.recordFailure("client", 0);
    limiter.recordFailure("client", 101);

    expect(limiter.check("client", 102)).toEqual({ allowed: true });
  });

  it("clears failures after a successful login", async () => {
    const limiter = await createLimiter({ maxAttempts: 2 });

    limiter.recordFailure("client", 0);
    limiter.recordSuccess("client");
    limiter.recordFailure("client", 1);

    expect(limiter.check("client", 2)).toEqual({ allowed: true });
  });

  it("tracks clients independently", async () => {
    const limiter = await createLimiter({ maxAttempts: 1 });

    limiter.recordFailure("blocked", 0);

    expect(limiter.check("blocked", 1)).toEqual({ allowed: false });
    expect(limiter.check("other", 1)).toEqual({ allowed: true });
  });

  it("evicts the oldest entry when storage is full", async () => {
    const limiter = await createLimiter({
      maxAttempts: 1,
      maxEntries: 2,
      blockMs: 1_000,
    });

    limiter.recordFailure("oldest", 0);
    limiter.recordFailure("middle", 1);
    limiter.recordFailure("newest", 2);

    expect(limiter.check("oldest", 3)).toEqual({ allowed: true });
    expect(limiter.check("middle", 3)).toEqual({ allowed: false });
    expect(limiter.check("newest", 3)).toEqual({ allowed: false });
  });
});
