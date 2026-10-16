import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrlValue = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrlValue ? describe : describe.skip;
const PSQL_PROCESS_TIMEOUT_MS = 10_000;
const VITEST_HOOK_TIMEOUT_MS = 25_000;
const schemaName = `admin_operations_${randomUUID().replaceAll("-", "")}`;
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20261016000000_admin_operations/migration.sql",
);

function validatedConnection(value: string) {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(
      "Admin operations migration tests require a local PostgreSQL host",
    );
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "Admin operations migration tests require a database ending in _test",
    );
  }

  url.search = "";
  return url.toString();
}

describeWithDatabase("admin operations migration against PostgreSQL", () => {
  let connection = "";

  function psql(...args: string[]) {
    return execFileSync(
      "psql",
      ["--dbname", connection, "-X", "-v", "ON_ERROR_STOP=1", "-1", ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PGCONNECT_TIMEOUT: "5",
          PGOPTIONS: `-c search_path=${schemaName},public -c lock_timeout=5000 -c statement_timeout=8000`,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: PSQL_PROCESS_TIMEOUT_MS,
      },
    );
  }

  function dropSchema() {
    if (!connection) return;

    psql("-c", `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }

  function cleanupAfterSetupFailure(primaryError: unknown): never {
    try {
      dropSchema();
    } catch {
      try {
        process.stderr.write(
          "Failed to clean up isolated admin operations schema after setup failure\n",
        );
      } catch {
        // Preserve the setup error even if reporting the cleanup failure fails.
      }
    }

    throw primaryError;
  }

  beforeAll(() => {
    connection = validatedConnection(databaseUrlValue!);

    try {
      psql(
        "-c",
        `
          CREATE SCHEMA "${schemaName}";
          SET search_path TO "${schemaName}", public;
          CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED');
          CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');
          CREATE TABLE "Donation" (
            "id" TEXT PRIMARY KEY,
            "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
            "paidAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE "ContactRequest" (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
          CREATE INDEX "ContactRequest_status_createdAt_idx"
            ON "ContactRequest"("status", "createdAt");
          INSERT INTO "Donation" ("id", "status", "paidAt") VALUES
            ('donation-pending', 'PENDING', NULL),
            ('donation-paid', 'SUCCEEDED', '2026-10-01 10:00:00');
          INSERT INTO "ContactRequest"
            ("id", "name", "email", "message", "status", "createdAt", "updatedAt")
          VALUES
            ('contact-new', 'New Person', 'new@example.com', 'First message', 'NEW', '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
            ('contact-closed', 'Closed Person', 'closed@example.com', 'Second message', 'CLOSED', '2026-10-02 10:00:00', '2026-10-02 10:00:00');
        `,
      );
      psql("--file", migrationPath);
    } catch (primaryError) {
      cleanupAfterSetupFailure(primaryError);
    }
  }, VITEST_HOOK_TIMEOUT_MS);

  afterAll(() => {
    dropSchema();
  }, VITEST_HOOK_TIMEOUT_MS);

  it("preserves legacy rows and adds nullable notes and the SPAM status", () => {
    const legacyRows = psql(
      "-At",
      "-c",
      `
        SELECT 'contact|' || "id" || '|' || "status"::text || '|' ||
          COALESCE("internalNote", 'NULL')
        FROM "ContactRequest"
        UNION ALL
        SELECT 'donation|' || "id" || '|' || "status"::text || '|' ||
          COALESCE(to_char("paidAt", 'YYYY-MM-DD HH24:MI:SS'), 'NULL')
        FROM "Donation"
        ORDER BY 1;
      `,
    )
      .trim()
      .split("\n");

    expect(legacyRows).toEqual([
      "contact|contact-closed|CLOSED|NULL",
      "contact|contact-new|NEW|NULL",
      "donation|donation-paid|SUCCEEDED|2026-10-01 10:00:00",
      "donation|donation-pending|PENDING|NULL",
    ]);

    psql(
      "-c",
      `INSERT INTO "ContactRequest"
        ("id", "name", "email", "message", "status", "createdAt", "updatedAt")
       VALUES
        ('contact-spam', 'Spam Person', 'spam@example.com', 'Spam message', 'SPAM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    );

    expect(
      psql(
        "-At",
        "-c",
        `SELECT "status"::text FROM "ContactRequest" WHERE "id" = 'contact-spam'`,
      ).trim(),
    ).toBe("SPAM");
  });

  it("creates an empty audit table with only allow-listed columns", () => {
    const columns = psql(
      "-At",
      "-c",
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'AdminAuditEvent'
        ORDER BY ordinal_position;
      `,
    )
      .trim()
      .split("\n");

    expect(columns).toEqual([
      "id",
      "actorKind",
      "action",
      "entityType",
      "entityId",
      "previousStatus",
      "nextStatus",
      "createdAt",
    ]);
    expect(
      psql("-At", "-c", 'SELECT count(*) FROM "AdminAuditEvent"').trim(),
    ).toBe("0");
  });

  it("creates every expected B-tree and GIN index", () => {
    const indexes = psql(
      "-At",
      "-c",
      `
        SELECT indexname || '|' ||
          CASE WHEN indexdef LIKE '% USING gin %' THEN 'gin' ELSE 'btree' END
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname IN (
            'Donation_status_paidAt_idx',
            'ContactRequest_status_createdAt_id_idx',
            'ContactRequest_createdAt_id_idx',
            'ContactRequest_name_trgm_idx',
            'ContactRequest_email_trgm_idx',
            'ContactRequest_message_trgm_idx',
            'AdminAuditEvent_createdAt_id_idx',
            'AdminAuditEvent_entityType_entityId_createdAt_idx'
          )
        ORDER BY indexname;
      `,
    )
      .trim()
      .split("\n");

    expect(indexes).toEqual([
      "AdminAuditEvent_createdAt_id_idx|btree",
      "AdminAuditEvent_entityType_entityId_createdAt_idx|btree",
      "ContactRequest_createdAt_id_idx|btree",
      "ContactRequest_email_trgm_idx|gin",
      "ContactRequest_message_trgm_idx|gin",
      "ContactRequest_name_trgm_idx|gin",
      "ContactRequest_status_createdAt_id_idx|btree",
      "Donation_status_paidAt_idx|btree",
    ]);
    expect(
      psql(
        "-At",
        "-c",
        `SELECT count(*) FROM pg_indexes
         WHERE schemaname = current_schema()
           AND indexname = 'ContactRequest_status_createdAt_idx'`,
      ).trim(),
    ).toBe("0");
  });
});
