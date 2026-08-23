import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823020000_content_publication/migration.sql",
);
const integrationTestPath = resolve(
  process.cwd(),
  "src/db/content-migration.integration.test.ts",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim()
  : "";
const integrationTestSource = readFileSync(integrationTestPath, "utf8");

const publicationStatements = [
  'ALTER TABLE "Document" ADD COLUMN "status" "PublicationStatus"',
  `UPDATE "Document" SET "status" = CASE WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED'::"PublicationStatus" ELSE 'DRAFT'::"PublicationStatus" END`,
  `ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
  'ALTER TABLE "Document" ALTER COLUMN "status" SET NOT NULL',
  `UPDATE "Project" SET "publishedAt" = "updatedAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL`,
  `UPDATE "NewsPost" SET "publishedAt" = "updatedAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL`,
  'CREATE INDEX "Project_status_publishedAt_id_idx"',
  'CREATE INDEX "NewsPost_status_publishedAt_id_idx"',
  'CREATE INDEX "Document_status_publishedAt_id_idx"',
];

function positionOf(source: string, statement: string) {
  const position = source.indexOf(statement);
  expect(position, `Missing SQL: ${statement}`).toBeGreaterThanOrEqual(0);
  return position;
}

function expectStatementsInOrder(source: string, statements: string[]) {
  let previousPosition = -1;

  for (const statement of statements) {
    const position = positionOf(source, statement);
    expect(position, `Out-of-order SQL: ${statement}`).toBeGreaterThan(
      previousPosition,
    );
    previousPosition = position;
  }
}

function numericSourceConstant(name: string) {
  const match = integrationTestSource.match(
    new RegExp(`const ${name} = ([\\d_]+);`),
  );
  expect(match, `Missing numeric constant: ${name}`).not.toBeNull();
  return Number(match![1].replaceAll("_", ""));
}

describe("content publication migration", () => {
  it("adds Document status as nullable before backfilling and constraining it", () => {
    const [addColumnSql, backfillSql, setDefaultSql, setNotNullSql] =
      publicationStatements;
    const addColumn = positionOf(migration, addColumnSql);
    const backfill = positionOf(migration, backfillSql);
    const setDefault = positionOf(migration, setDefaultSql);
    const setNotNull = positionOf(migration, setNotNullSql);

    expect(migration.slice(addColumn, backfill)).not.toContain("NOT NULL");
    expect(migration.slice(addColumn, backfill)).not.toContain("DEFAULT");
    expect(addColumn).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(setDefault);
    expect(setDefault).toBeLessThan(setNotNull);
  });

  it("applies every data and index change in safe order", () => {
    expectStatementsInOrder(migration, publicationStatements);
  });
});

describe("content migration integration harness", () => {
  it("bounds psql and PostgreSQL waits below the Vitest hook timeout", () => {
    const processTimeout = numericSourceConstant("PSQL_PROCESS_TIMEOUT_MS");
    const hookTimeout = numericSourceConstant("VITEST_HOOK_TIMEOUT_MS");

    expect(hookTimeout).toBeGreaterThan(processTimeout);
    expect(integrationTestSource).toContain(
      "timeout: PSQL_PROCESS_TIMEOUT_MS",
    );
    expect(integrationTestSource).toContain('PGCONNECT_TIMEOUT: "5"');
    expect(integrationTestSource).toContain("-c lock_timeout=5000");
    expect(integrationTestSource).toContain("-c statement_timeout=8000");
    expect(integrationTestSource).toContain(
      "}, VITEST_HOOK_TIMEOUT_MS);",
    );
  });

  it("disables psql startup files for every shared invocation", () => {
    expect(integrationTestSource).toContain(
      '["--dbname", connection, "-X", "-v", "ON_ERROR_STOP=1", "-1", ...args]',
    );
  });

  it("rethrows the primary setup error when cleanup also fails", () => {
    const cleanupHelper =
      integrationTestSource.match(
        /function cleanupAfterSetupFailure\([\s\S]*?\n  }\n\n  beforeAll/,
      )?.[0] ?? "";

    expect(cleanupHelper).toContain("try {");
    expect(cleanupHelper).toContain("dropSchema();");
    expect(cleanupHelper).toContain("catch {");
    expect(cleanupHelper).toContain("throw primaryError;");
    expect(integrationTestSource).toContain(
      "cleanupAfterSetupFailure(primaryError);",
    );
  });
});
