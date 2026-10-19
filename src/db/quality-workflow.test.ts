import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const { load } = createRequire(import.meta.url)("js-yaml") as {
  load: (source: string) => Workflow;
};
type Step = { uses?: string; with?: Record<string, unknown>; run?: string; env?: Record<string, string> };
interface Workflow {
  on: { pull_request: unknown; push: { branches: string[] } };
  permissions: { contents: string };
  concurrency: { group: string; "cancel-in-progress": boolean };
  env?: Record<string, string>;
  jobs: {
    quality: {
      "runs-on": string;
      container?: unknown;
      "timeout-minutes": number;
      env: Record<string, string>;
      services: { postgres: { image: string; env: Record<string, string>; ports: string[]; options: string } };
      steps: Step[];
    };
  };
}
const path = join(process.cwd(), ".github/workflows/quality.yml");
const workflow = existsSync(path) ? load(readFileSync(path, "utf8")) : undefined;
const databaseUrl = "postgresql://postgres:postgres@localhost:5432/foundation_quality_test";
const optionalKeys = ["CONTENT_MIGRATION_TEST_DATABASE_URL", "ADMIN_OPERATIONS_TEST_DATABASE_URL", "CONTENT_REPOSITORY_TEST_DATABASE_URL", "PAYMENTS_TEST_DATABASE_URL"];
const suites = [
  ["CONTENT_MIGRATION_TEST_DATABASE_URL", "src/db/content-migration.integration.test.ts"],
  ["ADMIN_OPERATIONS_TEST_DATABASE_URL", "src/db/admin-operations-migration.integration.test.ts"],
  ["CONTENT_REPOSITORY_TEST_DATABASE_URL", "src/features/content-admin/repository.integration.test.ts"],
  ["ADMIN_OPERATIONS_TEST_DATABASE_URL", "src/features/admin-operations.integration.test.ts"],
  ["ADMIN_OPERATIONS_TEST_DATABASE_URL", "src/features/maintenance/rate-limit-cleanup.integration.test.ts"],
];

describe("quality workflow", () => {
  it("checks pull requests and deployment branches with bounded, read-only runs", () => {
    expect(workflow, "quality workflow must exist").toBeDefined();
    if (!workflow) return;
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on.push.branches).toEqual(expect.arrayContaining(["develop", "master"]));
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({ group: "${{ github.workflow }}-${{ github.ref }}", "cancel-in-progress": true });
    expect(workflow.jobs.quality["timeout-minutes"]).toBeGreaterThan(0);
    expect(workflow.jobs.quality["timeout-minutes"]).toBeLessThanOrEqual(30);
  });

  it("uses a healthy isolated host PostgreSQL 16 service and dummy application config", () => {
    expect(workflow).toBeDefined();
    if (!workflow) return;
    const job = workflow.jobs.quality;
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.container).toBeUndefined();
    expect(job.services.postgres.image).toBe("postgres:16");
    expect(job.services.postgres.env.POSTGRES_DB).toBe("foundation_quality_test");
    expect(job.services.postgres.ports).toContain("5432:5432");
    expect(job.services.postgres.options).toContain("--health-cmd");
    expect(job.services.postgres.options).toContain("pg_isready");
    expect(job.env.DATABASE_URL).toBe(databaseUrl);
    expect(job.env.DATABASE_URL_UNPOOLED).toBe(databaseUrl);
    expect(String(job.env.PAYMENTS_ENABLED)).toBe("false");
    expect(job.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(job.env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(JSON.stringify(workflow)).not.toContain("secrets.");
  });

  it("installs dependencies and psql, migrates, verifies, and audits on Node 22", () => {
    expect(workflow).toBeDefined();
    if (!workflow) return;
    const steps = workflow.jobs.quality.steps;
    const node = steps.find((step) => step.uses === "actions/setup-node@v4");
    expect(String(node?.with?.["node-version"])).toBe("22");
    expect(node?.with?.cache).toBe("npm");
    const commands = steps.flatMap((step) => step.run ? [step.run] : []).join("\n");
    const required = ["npm ci", "sudo apt-get install -y postgresql-client", "psql --version", "npx prisma migrate deploy", "npm run verify", "npm audit --omit=dev --audit-level=high"];
    for (const command of required) expect(commands).toContain(command);
    expect(commands.indexOf("psql --version")).toBeLessThan(commands.indexOf("npm run verify"));
    expect(commands.indexOf("npx prisma migrate deploy")).toBeLessThan(commands.indexOf("npm run verify"));
  });

  it("leaves optional DB suites disabled during verify and runs each sequentially with only its own URL", () => {
    expect(workflow).toBeDefined();
    if (!workflow) return;
    const job = workflow.jobs.quality;
    const verifyIndex = job.steps.findIndex((step) => step.run === "npm run verify");
    expect(verifyIndex).toBeGreaterThan(-1);
    for (const env of [workflow.env, job.env, job.steps[verifyIndex]?.env]) {
      for (const key of optionalKeys) expect(env ?? {}).not.toHaveProperty(key);
    }
    let previousIndex = verifyIndex;
    for (const [key, file] of suites) {
      const index = job.steps.findIndex((step) => step.run === `npx vitest run ${file}`);
      expect(index, file).toBeGreaterThan(previousIndex);
      expect(job.steps[index]?.env).toEqual({ [key]: databaseUrl });
      previousIndex = index;
    }
  });
});
