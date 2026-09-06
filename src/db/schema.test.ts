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
const contentPublicationMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260823020000_content_publication/migration.sql",
);
const paymentRateLimitMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260824195000_payment_rate_limit_bucket/migration.sql",
);
const projectFundraisingMigrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260905100000_project_fundraising/migration.sql",
);

const schema = readFileSync(schemaPath, "utf8");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const donationListMigration = existsSync(donationListMigrationPath)
  ? readFileSync(donationListMigrationPath, "utf8")
  : "";
const contentPublicationMigration = existsSync(contentPublicationMigrationPath)
  ? readFileSync(contentPublicationMigrationPath, "utf8")
  : "";
const paymentRateLimitMigration = existsSync(paymentRateLimitMigrationPath)
  ? readFileSync(paymentRateLimitMigrationPath, "utf8")
  : "";
const projectFundraisingMigration = existsSync(projectFundraisingMigrationPath)
  ? readFileSync(projectFundraisingMigrationPath, "utf8")
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
  it("uses a pooled url and a direct url for serverless deploys", () => {
    expect(schema).toContain('url       = env("DATABASE_URL")');
    expect(schema).toContain('directUrl = env("DATABASE_URL_UNPOOLED")');
  });

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

  it("gives every content model the stable publication list order", () => {
    const document = schema.match(/model Document \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(document).toContain(
      "status      PublicationStatus @default(DRAFT)",
    );

    for (const model of ["Project", "NewsPost", "Document"]) {
      const modelSchema =
        schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0] ??
        "";

      expect(modelSchema).toContain("@@index([status, publishedAt, id])");
      expect(contentPublicationMigration).toContain(
        `CREATE INDEX "${model}_status_publishedAt_id_idx" ON "${model}"("status", "publishedAt", "id")`,
      );
    }
  });

  it("defines the payment rate-limit bucket model", () => {
    expect(schema).toContain(`model PaymentRateLimitBucket {
  key         String
  windowStart DateTime
  count       Int
  expiresAt   DateTime

  @@id([key, windowStart])
  @@index([expiresAt])
}`);
  });

  it("creates the payment rate-limit bucket table in a forward-only migration", () => {
    expect(paymentRateLimitMigration).toContain(
      'CREATE TABLE "PaymentRateLimitBucket"',
    );
    expect(paymentRateLimitMigration).toContain(
      '"windowStart" TIMESTAMP(3) NOT NULL',
    );
    expect(paymentRateLimitMigration).toContain(
      '"expiresAt" TIMESTAMP(3) NOT NULL',
    );
    expect(paymentRateLimitMigration).toContain(
      'CONSTRAINT "PaymentRateLimitBucket_pkey" PRIMARY KEY ("key", "windowStart")',
    );
    expect(paymentRateLimitMigration).toContain(
      'CREATE INDEX "PaymentRateLimitBucket_expiresAt_idx" ON "PaymentRateLimitBucket"("expiresAt")',
    );
    expect(paymentRateLimitMigration).not.toMatch(/\b(?:ALTER|DROP)\b/);
  });

  it("stores an optional project goal, a manual raised amount, and donation attribution", () => {
    const project = schema.match(/model Project \{[\s\S]*?\n\}/)?.[0] ?? "";
    const donation = schema.match(/model Donation \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(project).toContain("goalAmountKopecks   Int?");
    expect(project).toContain("manualRaisedKopecks Int            @default(0)");
    expect(project).toContain("donations           Donation[]");
    expect(donation).toContain("projectId         String?");
    expect(donation).toContain(
      "project           Project?       @relation(fields: [projectId], references: [id], onDelete: SetNull)",
    );
    expect(donation).toContain("@@index([status, projectId])");
  });

  it("adds fundraising columns in a forward-only migration", () => {
    expect(projectFundraisingMigration).toContain(
      'ALTER TABLE "Project" ADD COLUMN "goalAmountKopecks" INTEGER',
    );
    expect(projectFundraisingMigration).toContain(
      'ALTER TABLE "Project" ADD COLUMN "manualRaisedKopecks" INTEGER NOT NULL DEFAULT 0',
    );
    expect(projectFundraisingMigration).toContain(
      'ALTER TABLE "Donation" ADD COLUMN "projectId" TEXT',
    );
    expect(projectFundraisingMigration).toContain(
      'CREATE INDEX "Donation_status_projectId_idx" ON "Donation"("status", "projectId")',
    );
    expect(projectFundraisingMigration).toContain(
      'ALTER TABLE "Donation" ADD CONSTRAINT "Donation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    );
    expect(projectFundraisingMigration).not.toMatch(/\bDROP\b/);
  });
});
