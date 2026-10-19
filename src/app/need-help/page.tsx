import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/content/faq-list";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";
import { applicantFaqItems } from "@/content/faq";

export const metadata: Metadata = {
  title: "Нужна помощь",
  description: "Как обратиться в фонд «Быть Добру»: кто может написать, какие сведения нужны и когда ждать ответ.",
  alternates: { canonical: "/need-help" },
};

export default function NeedHelpPage() {
  return (
    <>
      <PageHero eyebrow="Обращение в фонд" title="Нужна помощь"
        description="Расскажите о своей ситуации. Фонд рассмотрит обращение и уточнит, какую поддержку может предложить." />

      <section className="page-section">
        <div className="container applicant-layout">
          <div className="applicant-main">
            <section>
              <h2>Кто может обратиться</h2>
              <p>Человек, которому нужна поддержка, его родственник или опекун, а также организация, которая сопровождает семью.</p>
            </section>
            <section>
              <h2>Какие сведения нужны</h2>
              <p>Для первого обращения достаточно короткого сообщения:</p>
              <ul className="application-checklist">
                <li><strong>Имя и электронная почта</strong><span>Чтобы мы могли обратиться к вам и отправить ответ.</span></li>
                <li><strong>Описание ситуации</strong><span>Что случилось и какая помощь нужна.</span></li>
                <li><strong>Город или район</strong><span>Где требуется поддержка.</span></li>
              </ul>
              <p>Если понадобятся документы или дополнительные сведения, фонд запросит их в ответном письме.</p>
            </section>
          </div>

          <aside className="applicant-panel" aria-label="Обращение и ответ фонда">
            <h2>Как подать обращение</h2>
            <p>Заполните форму на странице контактов. Укажите электронную почту, на которую можно ответить.</p>
            <Link className="button button-primary" href={siteConfig.contacts.formHref}>Написать через форму</Link>
            <p className="applicant-email">Или напишите на почту<br /><a href={`mailto:${siteConfig.legal.email}`}>{siteConfig.legal.emailLabel}</a></p>
            <div className="applicant-response">
              <h2>Когда ответим</h2>
              <p>Срок зависит от сложности ситуации. Проверьте папку «Спам»; если ответ задерживается, напишите на почту фонда и напомните о своём обращении.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="page-section applicant-faq">
        <div className="container">
          <div className="section-heading section-heading-plain"><div><h2>Частые вопросы</h2></div></div>
          <FaqList items={applicantFaqItems} />
        </div>
      </section>
    </>
  );
}
