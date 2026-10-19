CREATE TYPE "ContactRequestFolder" AS ENUM ('INBOX', 'ARCHIVE', 'TRASH');
ALTER TABLE "ContactRequest" ADD COLUMN "folder" "ContactRequestFolder" NOT NULL DEFAULT 'INBOX';
CREATE INDEX "ContactRequest_folder_createdAt_id_idx" ON "ContactRequest"("folder", "createdAt", "id");
ALTER TYPE "AdminAuditAction" ADD VALUE 'CONTACT_FOLDER_CHANGED';
