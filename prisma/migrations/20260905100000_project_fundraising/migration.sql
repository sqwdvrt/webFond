-- AlterTable
ALTER TABLE "Project" ADD COLUMN "goalAmountKopecks" INTEGER;
ALTER TABLE "Project" ADD COLUMN "manualRaisedKopecks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Donation_status_projectId_idx" ON "Donation"("status", "projectId");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
