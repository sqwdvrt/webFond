import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const integrationSource = readFileSync(
  resolve(
    process.cwd(),
    "src/features/payments/payments.integration.test.ts",
  ),
  "utf8",
);

describe("payment integration cleanup isolation", () => {
  it("deletes only centrally tracked payment test bucket keys", () => {
    expect(integrationSource).not.toMatch(
      /paymentRateLimitBucket\.deleteMany\(\s*\)/,
    );
    expect(integrationSource).toContain("const OWNED_BUCKET_KEYS");
    expect(integrationSource).toMatch(
      /paymentRateLimitBucket\.deleteMany\(\{\s*where:\s*\{\s*key:\s*\{\s*in:\s*OWNED_BUCKET_KEYS\s*\}/,
    );
  });

  it("declares each integration client-key fixture only once", () => {
    const clientKeyLiterals =
      integrationSource.match(/integration-client-[a-z-]+/g) ?? [];

    expect(clientKeyLiterals.length).toBeGreaterThan(0);
    expect(clientKeyLiterals).toHaveLength(new Set(clientKeyLiterals).size);
  });
});
