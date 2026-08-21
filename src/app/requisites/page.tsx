import type { Metadata } from "next";
import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Реквизиты", description: "Подтвержденные юридические сведения фонда «Быть Добру».", alternates: { canonical: "/requisites" } };

export default function RequisitesPage() {
  const rows = [["Полное наименование", siteConfig.name], ["Сокращенное наименование", siteConfig.shortName], ["ОГРН", siteConfig.legal.ogrn], ["ИНН", siteConfig.legal.inn], ["КПП", siteConfig.legal.kpp], ["Адрес", siteConfig.legal.address], ["Email", siteConfig.legal.email]];
  return <><PageHero eyebrow="Реквизиты" title="Сведения о фонде" description="На странице указаны только подтвержденные регистрационные данные." /><section className="page-section"><div className="container requisites-layout"><dl className="requisites-list">{rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl><EmptyState title="Банковские реквизиты готовятся к публикации" description="Они появятся после подтверждения владельцем фонда." /></div></section></>;
}
