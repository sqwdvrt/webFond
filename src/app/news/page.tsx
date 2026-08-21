import type { Metadata } from "next";
import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";

export const metadata: Metadata = { title: "Новости", description: "Новости фонда готовятся к публикации.", robots: { index: false, follow: true } };
export default function NewsPage() { return <><PageHero eyebrow="Новости" title="Новости фонда" description="Здесь будут появляться проверенные материалы о работе фонда." /><section className="page-section"><div className="container"><EmptyState title="Материалы готовятся к публикации" description="Новости появятся после проверки и утверждения." /></div></section></>; }
