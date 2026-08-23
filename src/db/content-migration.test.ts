import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823020000_content_publication/migration.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim()
  : "";

function positionOf(sql: string) {
  const position = migration.indexOf(sql);
  expect(position, `Missing SQL: ${sql}`).toBeGreaterThanOrEqual(0);
  return position;
}

describe("content publication migration", () => {
  it("adds Document status as nullable before backfilling and constraining it", () => {
    const addColumn = positionOf(
      'ALTER TABLE "Document" ADD COLUMN "status" "PublicationStatus"',
    );
    const backfill = positionOf(
      `UPDATE "Document" SET "status" = CASE WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED'::"PublicationStatus" ELSE 'DRAFT'::"PublicationStatus" END`,
    );
    const setDefault = positionOf(
      `ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    const setNotNull = positionOf(
      'ALTER TABLE "Document" ALTER COLUMN "status" SET NOT NULL',
    );

    expect(migration.slice(addColumn, backfill)).not.toContain("NOT NULL");
    expect(migration.slice(addColumn, backfill)).not.toContain("DEFAULT");
    expect(addColumn).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(setDefault);
    expect(setDefault).toBeLessThan(setNotNull);
  });

  it("repairs published content timestamps before creating list indexes", () => {
    const projectBackfill = positionOf(
      `UPDATE "Project" SET "publishedAt" = "updatedAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL`,
    );
    const newsBackfill = positionOf(
      `UPDATE "NewsPost" SET "publishedAt" = "updatedAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL`,
    );
    const firstIndex = positionOf(
      'CREATE INDEX "Project_status_publishedAt_id_idx"',
    );

    expect(projectBackfill).toBeLessThan(firstIndex);
    expect(newsBackfill).toBeLessThan(firstIndex);
  });
});
