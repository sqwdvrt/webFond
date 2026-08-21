import { LegalPlaceholder, legalPlaceholderMetadata } from "@/components/legal/legal-placeholder";
export const metadata = legalPlaceholderMetadata("Согласие на обработку данных");
export default function Page() { return <LegalPlaceholder title="Согласие на обработку данных" />; }
