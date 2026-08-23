import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrlValue = process.env.CONTENT_MIGRATION_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrlValue ? describe : describe.skip;
const schemaName = `content_migration_${randomUUID().replaceAll("-", "")}`;
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823020000_content_publication/migration.sql",
);

function validatedConnection(value: string) {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Content migration tests require a local PostgreSQL host");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error("Content migration tests require a database ending in _test");
  }

  url.search = "";
  return url.toString();
}

describeWithDatabase("content publication migration against PostgreSQL", () => {
  let connection = "";

  function psql(...args: string[]) {
    return execFileSync(
      "psql",
      ["--dbname", connection, "-v", "ON_ERROR_STOP=1", "-1", ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PGOPTIONS: `-c search_path=${schemaName}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }

  function dropSchema() {
    if (!connection) return;

    psql("-c", `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }

  beforeAll(() => {
    connection = validatedConnection(databaseUrlValue!);
    let setupComplete = false;

    try {
      psql(
        "-c",
        `
          CREATE SCHEMA "${schemaName}";
          SET search_path TO "${schemaName}";
          CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
          CREATE TABLE "Project" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "slug" TEXT NOT NULL UNIQUE,
            "summary" TEXT,
            "content" TEXT,
            "imageUrl" TEXT,
            "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
            "publishedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
          CREATE TABLE "NewsPost" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "slug" TEXT NOT NULL UNIQUE,
            "summary" TEXT,
            "content" TEXT,
            "imageUrl" TEXT,
            "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
            "publishedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
          CREATE TABLE "Document" (
            "id" TEXT PRIMARY KEY,
            "title" TEXT NOT NULL,
            "category" TEXT NOT NULL,
            "fileUrl" TEXT NOT NULL,
            "publishedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
          INSERT INTO "Project" ("id", "title", "slug", "status", "publishedAt", "updatedAt") VALUES
            ('project-draft', 'Draft project', 'project-draft', 'DRAFT', NULL, '2026-01-01 10:00:00'),
            ('project-published', 'Published project', 'project-published', 'PUBLISHED', NULL, '2026-01-02 10:00:00'),
            ('project-existing', 'Existing project', 'project-existing', 'PUBLISHED', '2025-12-01 10:00:00', '2026-01-03 10:00:00');
          INSERT INTO "NewsPost" ("id", "title", "slug", "status", "publishedAt", "updatedAt") VALUES
            ('news-draft', 'Draft news', 'news-draft', 'DRAFT', NULL, '2026-02-01 10:00:00'),
            ('news-published', 'Published news', 'news-published', 'PUBLISHED', NULL, '2026-02-02 10:00:00'),
            ('news-existing', 'Existing news', 'news-existing', 'PUBLISHED', '2025-12-02 10:00:00', '2026-02-03 10:00:00');
          INSERT INTO "Document" ("id", "title", "category", "fileUrl", "publishedAt", "updatedAt") VALUES
            ('document-draft', 'Draft document', 'REPORT', '/draft.pdf', NULL, '2026-03-01 10:00:00'),
            ('document-published', 'Published document', 'REPORT', '/published.pdf', '2026-03-02 10:00:00', '2026-03-03 10:00:00');
        `,
      );
      psql("--file", migrationPath);
      setupComplete = true;
    } finally {
      if (!setupComplete) dropSchema();
    }
  }, 30_000);

  afterAll(() => {
    dropSchema();
  });

  it("preserves rows and backfills publication state", () => {
    const rows = psql(
      "-At",
      "-c",
      `
        SELECT 'Document|' || "id" || '|' || "status"::text || '|' ||
          COALESCE(to_char("publishedAt", 'YYYY-MM-DD HH24:MI:SS'), 'NULL')
        FROM "Document"
        UNION ALL
        SELECT 'Project|' || "id" || '|' || "status"::text || '|' ||
          COALESCE(to_char("publishedAt", 'YYYY-MM-DD HH24:MI:SS'), 'NULL')
        FROM "Project"
        UNION ALL
        SELECT 'NewsPost|' || "id" || '|' || "status"::text || '|' ||
          COALESCE(to_char("publishedAt", 'YYYY-MM-DD HH24:MI:SS'), 'NULL')
        FROM "NewsPost"
        ORDER BY 1;
      `,
    )
      .trim()
      .split("\n");

    expect(rows).toEqual([
      "Document|document-draft|DRAFT|NULL",
      "Document|document-published|PUBLISHED|2026-03-02 10:00:00",
      "NewsPost|news-draft|DRAFT|NULL",
      "NewsPost|news-existing|PUBLISHED|2025-12-02 10:00:00",
      "NewsPost|news-published|PUBLISHED|2026-02-02 10:00:00",
      "Project|project-draft|DRAFT|NULL",
      "Project|project-existing|PUBLISHED|2025-12-01 10:00:00",
      "Project|project-published|PUBLISHED|2026-01-02 10:00:00",
    ]);
  });

  it("enforces the Document default and creates all list indexes", () => {
    psql(
      "-c",
      `INSERT INTO "Document" ("id", "title", "category", "fileUrl", "publishedAt", "updatedAt")
       VALUES ('document-default', 'Default document', 'REPORT', '/default.pdf', NULL, '2026-03-04 10:00:00')`,
    );

    expect(
      psql(
        "-At",
        "-c",
        `SELECT "status"::text FROM "Document" WHERE "id" = 'document-default'`,
      ).trim(),
    ).toBe("DRAFT");

    const indexes = psql(
      "-At",
      "-c",
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname LIKE '%_status_publishedAt_id_idx'
       ORDER BY indexname`,
    )
      .trim()
      .split("\n");

    expect(indexes).toEqual([
      "Document_status_publishedAt_id_idx",
      "NewsPost_status_publishedAt_id_idx",
      "Project_status_publishedAt_id_idx",
    ]);
  });
});
