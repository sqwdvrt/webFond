import { donationOfferPublication } from "@/content/donation-offer";
import { personalDataConsentPublication } from "@/content/legal";

export type DocumentAcceptance = {
  acceptedPersonalData?: boolean;
  consentVersion?: string;
  acceptedOffer?: boolean;
  offerVersion?: string;
};

export class ConsentRequiredError extends Error {
  constructor() {
    super("Current document consent is required");
    this.name = "ConsentRequiredError";
  }
}

export function contactConsentEvidence(acceptance: DocumentAcceptance, now: Date) {
  if (
    acceptance.acceptedPersonalData !== true ||
    acceptance.consentVersion !== personalDataConsentPublication.version
  ) {
    throw new ConsentRequiredError();
  }
  return {
    consentVersion: personalDataConsentPublication.version,
    consentAcceptedAt: now,
  };
}

export function donationConsentEvidence(acceptance: DocumentAcceptance, now: Date) {
  const consent = contactConsentEvidence(acceptance, now);
  if (
    acceptance.acceptedOffer !== true ||
    donationOfferPublication.status !== "published" ||
    acceptance.offerVersion !== donationOfferPublication.version
  ) {
    throw new ConsentRequiredError();
  }
  return {
    ...consent,
    offerVersion: donationOfferPublication.version,
    offerAcceptedAt: now,
  };
}
