import type { DonationOfferPublication } from "@/content/donation-offer";

type PaymentsGateInput = {
  enabledValue: string | undefined;
  configuredOfferVersion: string | undefined;
  offer: DonationOfferPublication;
};

type PaymentsGateResult = { enabled: true } | { enabled: false };

function isNonblank(value: string): boolean {
  return value.trim().length > 0;
}

export function evaluatePaymentsGate(
  input: PaymentsGateInput,
): PaymentsGateResult {
  const { configuredOfferVersion, enabledValue, offer } = input;

  if (
    enabledValue !== "true" ||
    configuredOfferVersion === undefined ||
    !isNonblank(configuredOfferVersion) ||
    offer.status !== "published" ||
    !isNonblank(offer.version) ||
    offer.version !== configuredOfferVersion ||
    !isNonblank(offer.title) ||
    offer.sections.length === 0
  ) {
    return { enabled: false };
  }

  const hasCompleteSections = offer.sections.every(
    (section) =>
      isNonblank(section.heading) &&
      section.paragraphs.length > 0 &&
      section.paragraphs.every(isNonblank),
  );

  return hasCompleteSections ? { enabled: true } : { enabled: false };
}
