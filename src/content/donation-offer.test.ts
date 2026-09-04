import { describe, expect, it } from "vitest";

import { donationOfferPublication } from "@/content/donation-offer";

describe("donation offer publication", () => {
  it("publishes the approved offer with a stable version", () => {
    expect(donationOfferPublication.status).toBe("published");
    if (donationOfferPublication.status !== "published") {
      return;
    }

    expect(donationOfferPublication.version).toBe("2026-09-04");
    expect(donationOfferPublication.title.length).toBeGreaterThan(0);
    expect(donationOfferPublication.sections.length).toBeGreaterThan(0);

    const personalData = donationOfferPublication.sections.find(
      (section) => section.heading === "7. Персональные данные",
    );
    expect(personalData?.paragraphs.join("\n")).toMatch(
      /адрес электронной почты[\s\S]*кассового чека[\s\S]*ЮKassa/,
    );
    expect(personalData?.paragraphs.join("\n")).toMatch(
      /Имя[\s\S]*не запрашивается/,
    );
    expect(personalData?.paragraphs.join("\n")).not.toMatch(
      /не запрашивает[\s\S]*адрес электронной почты/,
    );

    for (const section of donationOfferPublication.sections) {
      expect(section.heading.trim().length).toBeGreaterThan(0);
      expect(section.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of section.paragraphs) {
        expect(paragraph.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
