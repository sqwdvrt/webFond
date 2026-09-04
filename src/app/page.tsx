import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/content/section-heading";
import { siteConfig } from "@/config/site";
import { homepageHelpGroups } from "@/content/projects";
import { readPaymentsAvailability } from "@/features/payments/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: siteConfig.headline,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

type HomePageDependencies = {
  paymentsEnabled: () => boolean;
};

const defaultDependencies: HomePageDependencies = {
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

const helpSteps = [
  {
    title: "1. Напишите фонду",
    text: "Коротко расскажите, что случилось и какая помощь нужна. Можно через форму на сайте или по почте.",
  },
  {
    title: "2. Мы уточним ситуацию",
    text: "Если понадобятся документы или детали, напишем. Так помощь не остается формальной заявкой.",
  },
  {
    title: "3. Согласуем понятный формат помощи",
    text: "Скажем, чем фонд может помочь сейчас и что для этого нужно с вашей стороны.",
  },
] as const;

function trustItems(paymentsEnabled: boolean) {
  return [
    {
      title: "Проверяемые сведения",
      text: `Фонд зарегистрирован ${siteConfig.legal.registeredAt}. ОГРН ${siteConfig.legal.ogrn}, ИНН ${siteConfig.legal.inn}.`,
    },
    {
      title: "Открытые документы",
      text: "На сайте можно прочитать оферту, политику персональных данных и согласие на обработку.",
    },
    paymentsEnabled
      ? {
          title: "Онлайн-оплата",
          text: "Перевод доступен на странице помощи. Реквизиты карты обрабатывает платежный сервис, фонд их не хранит.",
        }
      : {
          title: "Честный статус платежей",
          text: "Онлайн-оплата еще подключается. Пока фонд принимает поддержку по реквизитам и через обращение.",
        },
  ] as const;
}

const documentLinks = [
  { href: "/requisites", label: "Реквизиты и ОГРН" },
  { href: "/donation-offer", label: "Оферта пожертвования" },
  { href: "/privacy", label: "Политика персональных данных" },
  { href: "/personal-data-consent", label: "Согласие на обработку данных" },
] as const;

export function renderHomePage(
  dependencies: HomePageDependencies = defaultDependencies,
) {
  let paymentsEnabled = false;
  try {
    paymentsEnabled = dependencies.paymentsEnabled();
  } catch {
    paymentsEnabled = false;
  }

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
                Нужна помощь
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
            title="Кому мы помогаем"
            intro="Фонд рядом с людьми, которым сейчас трудно, и с местами, которые важно сохранить."
          />
          <div className="info-grid">
            {homepageHelpGroups.map((group) => (
              <article className="info-card" key={group.title}>
                <h3>{group.title}</h3>
                <p>{group.lead}</p>
              </article>
            ))}
          </div>
          <p className="quiet-row">
            <Link href="/projects">Все направления</Link>
          </p>
        </div>
      </section>

      <section className="content-band surface-band">
        <div className="container">
          <SectionHeading
            number="02"
            title="Как работает помощь"
            intro="Сначала обращение, потом уточнение и понятный ответ. Без обещаний, которые фонд не может подтвердить."
          />
          <div className="info-grid">
            {helpSteps.map((step) => (
              <article className="info-card" key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading
            number="03"
            title="Почему нам можно доверять"
            intro="Доверие начинается с проверяемых данных, а не с красивых обещаний."
          />
          <div className="info-grid">
            {trustItems(paymentsEnabled).map((item) => (
              <article className="info-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-band surface-band">
        <div className="container">
          <SectionHeading
            number="04"
            title="Как помочь"
            intro="Можно поддержать фонд деньгами или написать, если готовы участвовать иначе."
          />
          <div className="help-now">
            <article className="help-card">
              <h3>Поддержать фонд</h3>
              <p>
                {paymentsEnabled
                  ? "Можно поддержать фонд онлайн или по банковским реквизитам."
                  : "Онлайн-оплата еще подключается. Реквизиты уже на сайте, туда же можно написать."}
              </p>
              <Link href="/help">
                {paymentsEnabled ? "Перейти к оплате" : "Перейти к помощи"}
              </Link>
            </article>
            <div className="help-note">
              <h3>Другие формы участия</h3>
              <p>
                Волонтерство, партнерство и информационная поддержка. Напишите, если готовы участвовать.
              </p>
              <Link href="/contacts">Написать фонду</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading
            number="05"
            title="Документы фонда"
            intro="Юридические сведения и документы, по которым можно проверить фонд."
          />
          <p className="quiet-row">
            {documentLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </p>
        </div>
      </section>

      <section className="contact-band">
        <div className="container contact-band-inner">
          <div>
            <span className="eyebrow">Контакты</span>
            <h2>Напишите нам</h2>
            <p>По вопросам о фонде, помощи и участии можно написать через форму на странице контактов.</p>
          </div>
          <Link className="button button-light" href="/contacts">
            Контакты
          </Link>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return renderHomePage();
}
