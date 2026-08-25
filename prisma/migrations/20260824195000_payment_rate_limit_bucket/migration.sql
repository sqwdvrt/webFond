-- CreateTable
CREATE TABLE "PaymentRateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRateLimitBucket_pkey" PRIMARY KEY ("key", "windowStart")
);

-- CreateIndex
CREATE INDEX "PaymentRateLimitBucket_expiresAt_idx" ON "PaymentRateLimitBucket"("expiresAt");
