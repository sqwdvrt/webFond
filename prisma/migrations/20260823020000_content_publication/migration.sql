-- AlterTable
ALTER TABLE "Document" ADD COLUMN "status" "PublicationStatus";

-- Backfill Document publication state before making the column required
UPDATE "Document"
SET "status" = CASE
    WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED'::"PublicationStatus"
    ELSE 'DRAFT'::"PublicationStatus"
END;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "Document" ALTER COLUMN "status" SET NOT NULL;

-- Backfill publication timestamps required by published-content ordering
UPDATE "Project"
SET "publishedAt" = "updatedAt"
WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;

UPDATE "NewsPost"
SET "publishedAt" = "updatedAt"
WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Project_status_publishedAt_id_idx" ON "Project"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "NewsPost_status_publishedAt_id_idx" ON "NewsPost"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "Document_status_publishedAt_id_idx" ON "Document"("status", "publishedAt", "id");
