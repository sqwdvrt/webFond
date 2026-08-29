import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  default as DonationOfferPage,
  renderDonationOfferPage,
} from "@/app/donation-offer/page";
import type { DonationOfferPublication } from "@/content/donation-offer";

const publishedOffer: DonationOfferPublication = {
  status: "published",
  version: "2026-08-24",
  title: "Утвержденная оферта",
  sections: [
    {
      heading: "Первый раздел",
      paragraphs: ["Первый абзац", "Второй абзац"],
    },
    {
      heading: "Второй раздел",
      paragraphs: ["Третий абзац"],
    },
  ],
};

describe("donation offer page", () => {
  it("renders the approved published offer from content", async () => {
    const { donationOfferPublication } = await import("@/content/donation-offer");
    expect(donationOfferPublication.status).toBe("published");
    if (donationOfferPublication.status !== "published") {
      return;
    }

    render(<DonationOfferPage />);

    expect(
      screen.getByRole("heading", {
        name: donationOfferPublication.title,
        level: 1,
      }),
    ).toBeVisible();
    expect(
      screen.queryByText("Текст требует утверждения юристом"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Скачать документ Word" }),
    ).toHaveAttribute("href", "/documents/oferta-pozherstvovaniya.docx");

    for (const section of donationOfferPublication.sections) {
      expect(
        screen.getByRole("heading", { name: section.heading, level: 2 }),
      ).toBeVisible();
    }
  });

  it("renders every field from an injected published offer", () => {
    render(renderDonationOfferPage(publishedOffer));

    expect(
      screen.getByRole("heading", { name: publishedOffer.title, level: 1 }),
    ).toBeVisible();

    for (const section of publishedOffer.sections) {
      expect(
        screen.getByRole("heading", { name: section.heading, level: 2 }),
      ).toBeVisible();
      for (const paragraph of section.paragraphs) {
        expect(screen.getByText(paragraph)).toBeVisible();
      }
    }

    expect(
      screen.queryByText("Текст требует утверждения юристом"),
    ).not.toBeInTheDocument();
  });
});
