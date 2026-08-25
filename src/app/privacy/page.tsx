import {
  publishedLegalMetadata,
  PublishedLegalDocumentView,
} from "@/components/legal/published-legal-document";
import { privacyPolicyPublication } from "@/content/legal";

export const metadata = publishedLegalMetadata(privacyPolicyPublication);

export default function Page() {
  return <PublishedLegalDocumentView document={privacyPolicyPublication} />;
}
