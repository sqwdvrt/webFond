ALTER TABLE "Donation"
  ADD COLUMN "lastProviderStatus" TEXT,
  ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
  ADD COLUMN "lastReconcileErrorCode" TEXT,
  ADD COLUMN "nextReconcileAt" TIMESTAMP(3),
  ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "claimExpiresAt" TIMESTAMP(3),
  ADD COLUMN "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Donation_status_nextReconcileAt_createdAt_idx"
  ON "Donation"("status", "nextReconcileAt", "createdAt");
