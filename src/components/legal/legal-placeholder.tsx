import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";

export function legalPlaceholderMetadata(title: string): Metadata { return { title, description: `${title}. Документ готовится к публикации.`, robots: { index: false, follow: true } }; }
export function LegalPlaceholder({ title }: { title: string }) { return <><PageHero eyebrow="Юридический документ" title={title} description="Документ готовится к публикации." /><section className="page-section"><div className="container legal-notice"><h2>Текст требует утверждения юристом</h2><p>Мы не публикуем предварительные или непроверенные юридические положения.</p></div></section></>; }
