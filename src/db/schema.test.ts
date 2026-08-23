import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823000000_initial/migration.sql",
);

const schema = readFileSync(schemaPath, "utf8");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
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
});
