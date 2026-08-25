import {
  publishedLegalMetadata,
  PublishedLegalDocumentView,
} from "@/components/legal/published-legal-document";
import { cookiesPublication } from "@/content/legal";

export const metadata = publishedLegalMetadata(cookiesPublication);

export default function Page() {
  return <PublishedLegalDocumentView document={cookiesPublication} />;
}
