import { describe, expect, it } from "vitest";

import type { DonationOfferPublication } from "@/content/donation-offer";
import { evaluatePaymentsGate } from "@/features/payments/gate";

const publishedOffer: DonationOfferPublication = {
  status: "published",
  version: "2026-08-24",
  title: "Оферта пожертвования",
  sections: [
    {
      heading: "Условия",
      paragraphs: ["Проверенный текст"],
    },
  ],
};

function evaluate(
  overrides: Partial<{
    enabledValue: string;
    configuredOfferVersion: string;
    offer: DonationOfferPublication;
  }> = {},
) {
  return evaluatePaymentsGate({
    enabledValue: "true",
    configuredOfferVersion: "2026-08-24",
    offer: publishedOffer,
    ...overrides,
  });
}

describe("evaluatePaymentsGate", () => {
  it("enables payments for exact configuration and complete published text", () => {
    expect(evaluate()).toEqual({ enabled: true });
  });

  it.each([undefined, "false", "TRUE", " true", "true "])(
    "keeps payments disabled unless enabledValue is exactly true: %s",
    (enabledValue) => {
      expect(evaluate({ enabledValue })).toEqual({ enabled: false });
    },
  );

  it.each([undefined, "", "2026-08-23"])(
    "keeps payments disabled for a missing or mismatched configured version: %s",
    (configuredOfferVersion) => {
      expect(evaluate({ configuredOfferVersion })).toEqual({ enabled: false });
    },
  );

  it("keeps payments disabled for a whitespace-only configured version", () => {
    expect(
      evaluate({
        configuredOfferVersion: " \t ",
        offer: { ...publishedOffer, version: " \t " },
      }),
    ).toEqual({ enabled: false });
  });

  it("keeps payments disabled for a whitespace-only published offer version", () => {
    expect(
      evaluate({
        configuredOfferVersion: "\n",
        offer: { ...publishedOffer, version: "\n" },
      }),
    ).toEqual({ enabled: false });
  });

  it("keeps payments disabled for the real placeholder shape", () => {
    expect(
      evaluate({
        offer: {
          status: "placeholder",
          version: null,
        },
      }),
    ).toEqual({ enabled: false });
  });

  it("keeps payments disabled without sections", () => {
    expect(
      evaluate({
        offer: {
          ...publishedOffer,
          sections: [],
        },
      }),
    ).toEqual({ enabled: false });
  });

  it("keeps payments disabled when a section has no paragraphs", () => {
    expect(
      evaluate({
        offer: {
          ...publishedOffer,
          sections: [{ heading: "Условия", paragraphs: [] }],
        },
      }),
    ).toEqual({ enabled: false });
  });

  it.each([
    {
      ...publishedOffer,
      title: " \t ",
    },
    {
      ...publishedOffer,
      sections: [{ heading: "\n", paragraphs: ["Проверенный текст"] }],
    },
    {
      ...publishedOffer,
      sections: [{ heading: "Условия", paragraphs: ["  "] }],
    },
  ] satisfies DonationOfferPublication[])(
    "keeps payments disabled for blank published text",
    (offer) => {
      expect(evaluate({ offer })).toEqual({ enabled: false });
    },
  );
});
