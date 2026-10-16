-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- AlterEnum
ALTER TYPE "ContactRequestStatus" ADD VALUE 'SPAM';

-- CreateEnum
CREATE TYPE "AdminAuditActorKind" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('CONTENT_CREATED', 'CONTENT_PUBLISHED', 'CONTENT_ARCHIVED', 'CONTENT_STATUS_CHANGED', 'CONTENT_DELETED', 'CONTACT_STATUS_CHANGED', 'CONTACT_NOTE_CHANGED');

-- CreateEnum
CREATE TYPE "AdminAuditEntityType" AS ENUM ('PROJECT', 'NEWS_POST', 'DOCUMENT', 'CONTACT_REQUEST');

-- AlterTable
ALTER TABLE "ContactRequest" ADD COLUMN "internalNote" TEXT;

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL,
    "actorKind" "AdminAuditActorKind" NOT NULL DEFAULT 'ADMIN',
    "action" "AdminAuditAction" NOT NULL,
    "entityType" "AdminAuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- Operational note: ordinary index builds on the existing Donation and ContactRequest tables block writes.
-- Run this migration in a maintenance window; rollout documentation will be added with the release docs.

-- CreateIndex
CREATE INDEX "Donation_status_paidAt_idx" ON "Donation"("status", "paidAt");

-- CreateIndex
CREATE INDEX "ContactRequest_status_createdAt_id_idx" ON "ContactRequest"("status", "createdAt", "id");

-- DropIndex
DROP INDEX "ContactRequest_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_id_idx" ON "ContactRequest"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ContactRequest_name_trgm_idx" ON "ContactRequest" USING GIN ("name" public.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ContactRequest_email_trgm_idx" ON "ContactRequest" USING GIN ("email" public.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ContactRequest_message_trgm_idx" ON "ContactRequest" USING GIN ("message" public.gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AdminAuditEvent_createdAt_id_idx" ON "AdminAuditEvent"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_entityType_entityId_createdAt_idx" ON "AdminAuditEvent"("entityType", "entityId", "createdAt");
