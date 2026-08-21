import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "О фонде", description: "Миссия, направления и подтвержденные сведения о фонде «Быть Добру».", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <><PageHero eyebrow="О фонде" title="О фонде" description="Поддержка людей, оказавшихся в трудной жизненной ситуации, и развитие взаимопомощи." /><section className="page-section"><div className="container text-grid"><div><span className="section-number">01 История</span></div><div className="prose"><h2>Фонд зарегистрирован 17 июля 2025 года в Москве</h2><p>Цель фонда: поддержка людей, оказавшихся в трудной жизненной ситуации, и развитие взаимопомощи.</p><p>Направления фонда включают поддержку социально незащищенных граждан, пожилых людей, детей и семей, которым нужна помощь.</p></div></div></section><section className="page-section surface-band"><div className="container text-grid"><div><span className="section-number">02 Принципы</span></div><div className="principles"><p><strong>Гуманизм</strong><span>Внимание к достоинству и обстоятельствам каждого человека.</span></p><p><strong>Взаимопомощь</strong><span>Объединение людей вокруг добрых дел.</span></p><p><strong>Уважение</strong><span>Ответственное и бережное отношение.</span></p><Link className="button button-primary" href="/projects">Направления работы</Link></div></div></section><section className="page-section"><div className="container legal-summary"><h2>Юридические сведения</h2><p>ОГРН {siteConfig.legal.ogrn}, ИНН {siteConfig.legal.inn}, КПП {siteConfig.legal.kpp}</p><Link href="/requisites">Все реквизиты</Link></div></section></>;
}
