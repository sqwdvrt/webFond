import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = join(
  process.cwd(),
  ".github/workflows/payments-integration.yml",
);

describe("payments integration workflow", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  it("runs on pull requests with a PostgreSQL service and required commands", () => {
    expect(workflow).toContain("pull_request");
    expect(workflow).toContain("postgres");
    expect(workflow).toContain("foundation_payments_test");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npx prisma migrate deploy");
    expect(workflow).toContain("npm run test:integration:payments");
  });

  it("uses the same CI URL for DATABASE_URL and PAYMENTS_TEST_DATABASE_URL", () => {
    const databaseUrl = workflow.match(/DATABASE_URL:\s*(.+)/)?.[1]?.trim();
    const paymentsUrl = workflow
      .match(/PAYMENTS_TEST_DATABASE_URL:\s*(.+)/)?.[1]
      ?.trim();

    expect(databaseUrl).toBeTruthy();
    expect(paymentsUrl).toBe(databaseUrl);
    expect(databaseUrl).toContain("foundation_payments_test");
  });
});
