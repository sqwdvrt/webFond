-- Historical records deliberately retain NULL evidence.
ALTER TABLE "ContactRequest" ADD COLUMN "consentVersion" TEXT, ADD COLUMN "consentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Donation" ADD COLUMN "consentVersion" TEXT, ADD COLUMN "consentAcceptedAt" TIMESTAMP(3), ADD COLUMN "offerVersion" TEXT, ADD COLUMN "offerAcceptedAt" TIMESTAMP(3);
