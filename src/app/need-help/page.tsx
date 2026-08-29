import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";
import { faqItems } from "@/content/faq";

export const metadata: Metadata = {
  title: "Нужна помощь",
  description:
    "Как обратиться в фонд «Быть Добру»: кто может написать, какие сведения нужны и когда ждать ответ.",
  alternates: { canonical: "/need-help" },
};

const applicationItems = [
  "имя и способ связи: почта или телефон",
  "что случилось и какая помощь нужна",
  "город или район, если это важно для помощи",
  "документы или пояснения, если они уже есть",
] as const;

export default function NeedHelpPage() {
  return (
    <>
      <PageHero
        eyebrow="Обращение в фонд"
        title="Нужна помощь"
        description="Фонд принимает обращения людей, которым нужна поддержка, и тех, кто пишет за близкого человека."
      />

      <section className="page-section">
        <div className="container text-grid">
          <div>
            <span className="section-number">01</span>
          </div>
          <div className="prose">
            <h2>Кто может обратиться</h2>
            <p>
              Написать может человек, которому нужна помощь, родственник, опекун или организация,
              которая сопровождает семью. Если ситуация срочная и связана с угрозой жизни, сначала
              обратитесь в экстренные службы.
            </p>
          </div>
        </div>
      </section>

      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">02</span>
          </div>
          <div className="prose">
            <h2>Какие сведения нужны</h2>
            <ul>
              {applicationItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container text-grid">
          <div>
            <span className="section-number">03</span>
          </div>
          <div className="prose">
            <h2>Как подать обращение</h2>
            <p>
              Самый прямой путь - форма на странице контактов. Можно также написать на почту{" "}
              <a href={`mailto:${siteConfig.legal.emailLabel}`}>{siteConfig.legal.emailLabel}</a>.
            </p>
            <p>
              <Link className="button button-primary" href="/contacts">
                Написать через форму
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">04</span>
          </div>
          <div className="prose">
            <h2>Когда ответим</h2>
            <p>
              Мы читаем обращения и отвечаем на указанную почту. Если нужны дополнительные сведения,
              напишем. Срок зависит от сложности ситуации; если ответ задерживается, можно напомнить
              тем же письмом.
            </p>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">05</span>
            <div>
              <h2>Частые вопросы</h2>
            </div>
          </div>
          <div className="faq-list">
            {faqItems.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
