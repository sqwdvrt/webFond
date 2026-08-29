import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/content/section-heading";
import { siteConfig } from "@/config/site";
import { charterGroups } from "@/content/projects";

export const metadata: Metadata = {
  title: siteConfig.headline,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Благотворительный фонд</span>
            <h1>{siteConfig.headline}</h1>
            <p className="hero-lead">{siteConfig.description}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/help">
                Помочь фонду
              </Link>
              <Link className="button button-secondary" href={siteConfig.routes.contactsForHelp}>
                Нужна помощь?
              </Link>
            </div>
          </div>
          <div className="hero-logo">
            <Image
              src="/brand/mark.jpg"
              width={880}
              height={880}
              sizes="(max-width: 720px) 70vw, 360px"
              priority
              alt="Знак фонда «Быть Добру»: руки, росток и птица"
            />
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading
            number="01"
            title="Цели, предмет и виды деятельности фонда"
            intro="По уставу фонд вправе поддерживать людей, сохранять значимые места и объединять тех, кто хочет помочь."
          />
          <div className="info-grid">
            {charterGroups.map((group) => (
              <article className="info-card" key={group.title}>
                <h3>{group.title}</h3>
                <p>{group.lead}</p>
              </article>
            ))}
          </div>
          <p className="quiet-row">
            <Link href="/projects">Полный перечень по уставу</Link>
          </p>
        </div>
      </section>

      <section className="content-band surface-band">
        <div className="container">
          <SectionHeading
            number="02"
            title="Как помочь"
            intro="Поддержать фонд можно пожертвованием. По другим формам участия напишите нам."
          />
          <div className="help-now">
            <article className="help-card">
              <h3>Поддержать фонд</h3>
              <p>
                Онлайн-оплата через СБП находится в подключении. Реквизиты и
                контакты фонда опубликованы на сайте.
              </p>
              <Link href="/help">Перейти к помощи</Link>
            </article>
            <div className="help-note">
              <h3>Другие формы участия</h3>
              <p>
                Волонтерство, партнерство и информационная поддержка. Напишите
                нам, если готовы участвовать.
              </p>
              <Link href="/contacts">Написать фонду</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading
            number="03"
            title="Новости и отчеты"
            intro="Новости фонда и отчетные документы публикуются в соответствующих разделах."
          />
          <div className="quiet-row">
            <Link href="/news">Новости</Link>
            <Link href="/reports">Отчеты</Link>
          </div>
        </div>
      </section>

      <section className="contact-band">
        <div className="container contact-band-inner">
          <div>
            <span className="eyebrow">Контакты</span>
            <h2>Напишите нам</h2>
            <p>По вопросам о фонде можно написать через форму на странице контактов.</p>
          </div>
          <Link className="button button-light" href="/contacts">
            Контакты
          </Link>
        </div>
      </section>
    </>
  );
}
