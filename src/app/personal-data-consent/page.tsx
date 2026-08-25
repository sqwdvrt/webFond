import {
  publishedLegalMetadata,
  PublishedLegalDocumentView,
} from "@/components/legal/published-legal-document";
import { personalDataConsentPublication } from "@/content/legal";

export const metadata = publishedLegalMetadata(personalDataConsentPublication);

export default function Page() {
  return (
    <PublishedLegalDocumentView document={personalDataConsentPublication} />
  );
}
