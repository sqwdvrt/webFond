import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Контакты", description: "Адрес и электронная почта фонда «Быть Добру».", alternates: { canonical: "/contacts" } };

export default function ContactsPage() {
  return <><PageHero eyebrow="Контакты" title="Связаться с фондом" description="По вопросам о направлениях работы и участии напишите нам по электронной почте." /><section className="page-section" id="help-request"><div className="container contact-details"><div><Mail aria-hidden="true" /><h2>Электронная почта</h2><a href={`mailto:${siteConfig.legal.email}`}>{siteConfig.legal.email}</a><p>По email можно задать вопрос о направлениях работы фонда. Сайт не принимает и не обрабатывает заявки на помощь.</p></div><div><MapPin aria-hidden="true" /><h2>Адрес</h2><address>{siteConfig.legal.address}</address><p>Перед визитом свяжитесь с фондом по email.</p></div></div></section></>;
}
