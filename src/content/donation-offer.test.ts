import { describe, expect, it } from "vitest";

import { donationOfferPublication } from "@/content/donation-offer";

describe("donation offer publication", () => {
  it("remains a placeholder until approved text is published", () => {
    expect(donationOfferPublication).toEqual({
      status: "placeholder",
      version: null,
    });
  });
});
