import type { Metadata } from "next";

import { LegalPlaceholder, legalPlaceholderMetadata } from "@/components/legal/legal-placeholder";
import { PublishedLegalDocumentView } from "@/components/legal/published-legal-document";
import {
  donationOfferPublication,
  type DonationOfferPublication,
} from "@/content/donation-offer";

export const metadata: Metadata =
  donationOfferPublication.status === "published"
    ? {
        title: donationOfferPublication.title,
        description:
          "Публичная оферта о заключении договора пожертвования Фонду «Быть Добру».",
        alternates: { canonical: "/donation-offer" },
      }
    : legalPlaceholderMetadata("Оферта пожертвования");

export function renderDonationOfferPage(offer: DonationOfferPublication) {
  if (offer.status === "placeholder") {
    return <LegalPlaceholder title="Оферта пожертвования" />;
  }

  return (
    <PublishedLegalDocumentView
      document={{
        status: "published",
        version: offer.version,
        title: offer.title,
        description:
          "Публичная оферта о заключении договора пожертвования Фонду «Быть Добру».",
        canonical: "/donation-offer",
        sections: offer.sections,
      }}
    />
  );
}

export default function Page() {
  return renderDonationOfferPage(donationOfferPublication);
}
