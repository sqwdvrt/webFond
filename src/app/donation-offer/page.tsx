import { LegalPlaceholder, legalPlaceholderMetadata } from "@/components/legal/legal-placeholder";
import {
  donationOfferPublication,
  type DonationOfferPublication,
} from "@/content/donation-offer";

export const metadata = legalPlaceholderMetadata("Оферта пожертвования");

export function renderDonationOfferPage(offer: DonationOfferPublication) {
  if (offer.status === "placeholder") {
    return <LegalPlaceholder title="Оферта пожертвования" />;
  }

  return (
    <section className="page-section">
      <div className="container published-body">
        <h1>{offer.title}</h1>
        {offer.sections.map((section, sectionIndex) => (
          <section key={sectionIndex}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  return renderDonationOfferPage(donationOfferPublication);
}
