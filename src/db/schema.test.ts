import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823000000_initial/migration.sql",
);
const donationListMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823010000_donation_list_index/migration.sql",
);

const schema = readFileSync(schemaPath, "utf8");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const donationListMigration = existsSync(donationListMigrationPath)
  ? readFileSync(donationListMigrationPath, "utf8")
  : "";

const requiredModels = [
  "Donation",
  "Project",
  "NewsPost",
  "Document",
  "SiteSetting",
  "ContactRequest",
];

describe("Prisma schema", () => {
  it("keeps only the managed-content and operational models", () => {
    for (const model of requiredModels) {
      expect(schema).toContain(`model ${model} {`);
    }

    expect(schema).not.toContain("model AdminUser {");
    expect(schema).not.toContain("enum AdminRole {");
  });

  it("has an initial migration for every required model", () => {
    for (const model of requiredModels) {
      expect(migration).toContain(`CREATE TABLE \"${model}\"`);
    }
  });

  it("indexes the stable donation list order", () => {
    expect(schema).toContain("@@index([createdAt, id])");
    expect(donationListMigration).toContain(
      'CREATE INDEX "Donation_createdAt_id_idx" ON "Donation"("createdAt", "id")',
    );
  });
});
