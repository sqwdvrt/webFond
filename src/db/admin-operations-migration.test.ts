import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20261016000000_admin_operations/migration.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const normalizedMigration = migration.replace(/\s+/g, " ").trim();

describe("admin operations migration", () => {
  it("extends contact requests without rewriting legacy rows", () => {
    expect(normalizedMigration).toContain(
      `ALTER TYPE "ContactRequestStatus" ADD VALUE 'SPAM'`,
    );
    expect(normalizedMigration).toContain(
      'ALTER TABLE "ContactRequest" ADD COLUMN "internalNote" TEXT',
    );
    expect(normalizedMigration).not.toContain(
      'ADD COLUMN "internalNote" TEXT NOT NULL',
    );
    expect(normalizedMigration).not.toContain('UPDATE "ContactRequest"');
  });

  it("creates only allow-listed audit fields and does not backfill events", () => {
    expect(normalizedMigration).toContain(
      `CREATE TYPE "AdminAuditActorKind" AS ENUM ('ADMIN')`,
    );
    expect(normalizedMigration).toContain(
      `CREATE TYPE "AdminAuditAction" AS ENUM ('CONTENT_CREATED', 'CONTENT_PUBLISHED', 'CONTENT_ARCHIVED', 'CONTENT_STATUS_CHANGED', 'CONTENT_DELETED', 'CONTACT_STATUS_CHANGED', 'CONTACT_NOTE_CHANGED')`,
    );
    expect(normalizedMigration).toContain(
      `CREATE TYPE "AdminAuditEntityType" AS ENUM ('PROJECT', 'NEWS_POST', 'DOCUMENT', 'CONTACT_REQUEST')`,
    );

    const auditTable =
      migration.match(/CREATE TABLE "AdminAuditEvent" \([\s\S]*?\n\);/)?.[0] ??
      "";

    for (const column of [
      "id",
      "actorKind",
      "action",
      "entityType",
      "entityId",
      "previousStatus",
      "nextStatus",
      "createdAt",
    ]) {
      expect(auditTable).toContain(`"${column}"`);
    }
    expect(auditTable).not.toMatch(
      /"(?:name|email|message|internalNote)"|\bJSONB?\b/i,
    );
    expect(normalizedMigration).not.toContain('INSERT INTO "AdminAuditEvent"');
  });

  it("creates stable B-tree indexes for operational queries", () => {
    expect(normalizedMigration).toContain(
      'CREATE INDEX "Donation_status_paidAt_idx" ON "Donation"("status", "paidAt")',
    );
    expect(normalizedMigration).toContain(
      'DROP INDEX "ContactRequest_status_createdAt_idx"',
    );
    expect(normalizedMigration).toContain(
      'CREATE INDEX "ContactRequest_status_createdAt_id_idx" ON "ContactRequest"("status", "createdAt", "id")',
    );
    expect(normalizedMigration).toContain(
      'CREATE INDEX "ContactRequest_createdAt_id_idx" ON "ContactRequest"("createdAt", "id")',
    );
    expect(normalizedMigration).toContain(
      'CREATE INDEX "AdminAuditEvent_createdAt_id_idx" ON "AdminAuditEvent"("createdAt", "id")',
    );
    expect(normalizedMigration).toContain(
      'CREATE INDEX "AdminAuditEvent_entityType_entityId_createdAt_idx" ON "AdminAuditEvent"("entityType", "entityId", "createdAt")',
    );
  });

  it("enables trigram search and indexes each searchable contact field", () => {
    expect(normalizedMigration).toContain(
      "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    );

    for (const field of ["name", "email", "message"]) {
      expect(normalizedMigration).toContain(
        `CREATE INDEX "ContactRequest_${field}_trgm_idx" ON "ContactRequest" USING GIN ("${field}" gin_trgm_ops)`,
      );
    }
  });
});
