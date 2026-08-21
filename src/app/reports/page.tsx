import type { Metadata } from "next";
import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";

export const metadata: Metadata = { title: "Отчеты", description: "Отчеты фонда готовятся к публикации.", robots: { index: false, follow: true } };
export default function ReportsPage() { return <><PageHero eyebrow="Отчеты" title="Отчеты фонда" description="Мы опубликуем документы после проверки и утверждения." /><section className="page-section"><div className="container"><EmptyState title="Проверенные отчеты появятся здесь" description="PDF будут доступны после проверки документов." /></div></section></>; }
