import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const { load } = createRequire(import.meta.url)("js-yaml") as {
  load: (source: string) => Workflow;
};
interface Workflow {
  on: { pull_request: unknown; push: { branches: string[] } };
  permissions: { contents: string };
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: {
    payments: {
      "runs-on": string;
      container?: unknown;
      "timeout-minutes": number;
      env: Record<string, string>;
      services: {
        postgres: { image: string; env: Record<string, string>; ports: string[]; options: string };
      };
      steps: { uses?: string; with?: Record<string, unknown>; run?: string }[];
    };
  };
}
const workflow = load(readFileSync(join(process.cwd(), ".github/workflows/payments-integration.yml"), "utf8"));
const job = workflow.jobs.payments;

describe("payments integration workflow", () => {
  it("checks pull requests and both deployment branches with bounded, read-only runs", () => {
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on.push.branches).toEqual(expect.arrayContaining(["develop", "master"]));
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": true,
    });
    expect(job["timeout-minutes"]).toBeGreaterThan(0);
    expect(job["timeout-minutes"]).toBeLessThanOrEqual(30);
  });

  it("connects the host runner and Prisma migrations to the same isolated PostgreSQL 16 database", () => {
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.container).toBeUndefined();
    const service = job.services.postgres;
    expect(service.image).toBe("postgres:16");
    expect(service.env.POSTGRES_DB).toBe("foundation_payments_test");
    expect(service.ports).toContain("5432:5432");
    expect(service.options).toContain("--health-cmd");
    expect(service.options).toContain("pg_isready");
    const expectedUrl = "postgresql://postgres:postgres@localhost:5432/foundation_payments_test";
    for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "PAYMENTS_TEST_DATABASE_URL"]) {
      expect(job.env[key]).toBe(expectedUrl);
    }
  });

  it("installs on Node 22 and deploys migrations before the dedicated payments suite", () => {
    const node = job.steps.find((step) => step.uses === "actions/setup-node@v4");
    expect(String(node?.with?.["node-version"])).toBe("22");
    expect(node?.with?.cache).toBe("npm");
    const commands = job.steps.flatMap((step) => step.run ? [step.run] : []);
    expect(commands).toEqual([
      "npm ci",
      "npx prisma migrate deploy",
      "npm run test:integration:payments",
    ]);
  });
});
