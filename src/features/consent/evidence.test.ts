import { describe, expect, it } from "vitest";
import { personalDataConsentPublication } from "@/content/legal";
import { donationOfferPublication } from "@/content/donation-offer";
import { contactConsentEvidence, donationConsentEvidence, ConsentRequiredError } from "./evidence";

const now = new Date("2026-11-17T18:00:00.000Z");
const acceptance = { acceptedPersonalData: true, consentVersion: personalDataConsentPublication.version, acceptedOffer: true, offerVersion: donationOfferPublication.version ?? undefined };
describe("document acceptance evidence", () => {
  it("uses the accepted published versions and server time", () => {
    expect(donationConsentEvidence(acceptance, now)).toEqual({ consentVersion: acceptance.consentVersion, consentAcceptedAt: now, offerVersion: acceptance.offerVersion, offerAcceptedAt: now });
    expect(contactConsentEvidence(acceptance, now)).toEqual({ consentVersion: acceptance.consentVersion, consentAcceptedAt: now });
  });
  it.each([{ acceptedPersonalData: false }, { consentVersion: undefined }, { consentVersion: "stale" }, { acceptedOffer: false }, { offerVersion: undefined }, { offerVersion: "stale" }])("rejects missing or changed acceptance %j", change => {
    expect(() => donationConsentEvidence({ ...acceptance, ...change }, now)).toThrow(ConsentRequiredError);
  });
});
