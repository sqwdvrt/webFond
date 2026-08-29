import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";
import { charterGroups } from "@/content/projects";

export const metadata: Metadata = {
  title: "О фонде",
  description:
    "Благотворительный фонд «Быть Добру». Зарегистрирован в Москве 17 июля 2025 года.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="О фонде"
        title="Быть Добру"
        description={siteConfig.tagline}
      />

      <section className="page-section">
        <div className="container text-grid">
          <div>
            <span className="section-number">01</span>
          </div>
          <div className="prose">
            <h2>Фонд зарегистрирован 17 июля 2025 года в Москве</h2>
            <p>
              Благотворительный фонд «Быть Добру» помогает людям в трудной ситуации
              и тем, кто хочет поддержать добрые дела.
            </p>
          </div>
        </div>
      </section>

      <section className="page-section surface-band">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <h2>Кому можем помогать</h2>
            </div>
          </div>
          <div className="info-grid">
            {charterGroups.map((group) => (
              <article className="info-card" key={group.title}>
                <h3>{group.title}</h3>
                <p>{group.lead}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.description}>{item.homepageDescription}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="quiet-row">
            <Link href="/projects">Все направления</Link>
          </p>
        </div>
      </section>

      <section className="page-section surface-band">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">03</span>
            <div>
              <h2>Сведения</h2>
            </div>
          </div>
          <div className="fact-strip">
            <dl>
              <dt>Дата регистрации</dt>
              <dd>{siteConfig.legal.registeredAt}</dd>
            </dl>
            <dl>
              <dt>Город</dt>
              <dd>Москва</dd>
            </dl>
            <dl>
              <dt>ОГРН</dt>
              <dd>{siteConfig.legal.ogrn}</dd>
            </dl>
            <dl>
              <dt>ИНН</dt>
              <dd>{siteConfig.legal.inn}</dd>
            </dl>
            <dl>
              <dt>Почта</dt>
              <dd>
                <a href={`mailto:${siteConfig.legal.emailLabel}`}>
                  {siteConfig.legal.emailLabel}
                </a>
              </dd>
            </dl>
            <dl>
              <dt>Все данные</dt>
              <dd>
                <Link href="/requisites">Реквизиты фонда</Link>
              </dd>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
