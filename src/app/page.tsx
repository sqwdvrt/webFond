import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/content/section-heading";
import { HomeEvidence } from "@/components/content/home-evidence";
import { siteConfig } from "@/config/site";
import { homepageHelpGroups } from "@/content/projects";
import { readPaymentsAvailability } from "@/features/payments/config";
import { loadHomeEvidence, type HomeEvidenceData } from "@/features/homepage/evidence";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: siteConfig.headline,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

type HomePageDependencies = {
  paymentsEnabled: () => boolean;
  evidence?: HomeEvidenceData;
};

const defaultDependencies: HomePageDependencies = {
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

const helpSteps = [
  { title: "Напишите фонду", text: "Коротко расскажите о ситуации и оставьте электронную почту для ответа." },
  { title: "Уточним обстоятельства", text: "Если понадобятся дополнительные сведения или документы, фонд запросит их в ответном письме." },
  { title: "Обсудим возможность помощи", text: "Фонд сообщит, какую поддержку может предложить и что для этого потребуется." },
] as const;

export function renderHomePage(dependencies: HomePageDependencies = defaultDependencies) {
  let paymentsEnabled = false;
  try {
    paymentsEnabled = dependencies.paymentsEnabled();
  } catch {
    paymentsEnabled = false;
  }
  const evidence = dependencies.evidence ?? { documents: [], projects: [] };
  const hasEvidence = evidence.projects === null || evidence.documents === null
    || evidence.projects.length > 0 || evidence.documents.length > 0;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Благотворительный фонд «Быть Добру»</span>
            <h1>Помогаем людям в трудной жизненной ситуации</h1>
            <p className="hero-lead">Поддерживаем людей, которым нужна помощь, и объединяем тех, кто готов участвовать.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/help">Помочь фонду</Link>
              <Link className="button button-secondary" href={siteConfig.routes.contactsForHelp}>Нужна помощь</Link>
            </div>
          </div>
          <div className="hero-logo">
            <Image src="/brand/mark.jpg" width={880} height={880}
              sizes="(max-width: 720px) 1px, 240px"
              alt="Знак фонда «Быть Добру»: руки, росток и птица" />
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading title="Кому мы помогаем" intro="Поддержка людей и сохранение значимых мест: направления деятельности фонда." />
          <div className="info-grid">
            {homepageHelpGroups.map((group) => (
              <article className="info-card" key={group.title}><h3>{group.title}</h3><p>{group.lead}</p></article>
            ))}
          </div>
          <p className="quiet-row"><Link href="/projects">Все направления</Link></p>
        </div>
      </section>

      {hasEvidence ? (
        <section className="content-band surface-band">
          <div className="container">
            <SectionHeading title="Проекты и отчётность" intro="Опубликованные материалы о работе фонда." />
            <HomeEvidence data={evidence} />
          </div>
        </section>
      ) : null}

      <section className="content-band surface-band">
        <div className="container">
          <SectionHeading title="Как помочь" intro="Поддержите деятельность фонда или предложите своё участие." />
          <div className="help-now">
            <article className="help-card">
              <h3>Поддержать фонд</h3>
              <p>{paymentsEnabled ? "Можно поддержать фонд онлайн или по банковским реквизитам." : "Поддержать фонд можно банковским переводом."}</p>
              <Link href="/help">{paymentsEnabled ? "Перейти к оплате" : "Перейти к переводу"}</Link>
            </article>
            <article className="help-note">
              <h3>Другие формы участия</h3>
              <p>Предложите помощь вещами, время и навыки или сотрудничество. Фонд уточнит, какая поддержка нужна сейчас.</p>
              <Link href={siteConfig.contacts.formHref}>Написать фонду</Link>
            </article>
          </div>
          <div className="home-donation-purpose">
            <h3>На что идут пожертвования</h3>
            <p>На помощь людям, сохранение значимых мест и организационные расходы, связанные с благотворительной деятельностью, в установленных законом пределах.</p>
            <p className="quiet-row"><Link href="/donation-offer">Цели использования пожертвований в оферте</Link></p>
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="container">
          <SectionHeading title="Как обратиться за помощью" intro="Напишите о своей ситуации. Возможность и формат поддержки фонд уточнит при рассмотрении обращения." />
          <ol className="help-steps" role="list">
            {helpSteps.map((step) => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p></li>)}
          </ol>
          <p className="quiet-row"><Link href="/need-help">Как подать обращение</Link><Link href={siteConfig.contacts.formHref}>Написать через форму</Link></p>
        </div>
      </section>

      <section className="content-band surface-band">
        <div className="container">
          <SectionHeading title="О фонде и документы" intro={`Фонд зарегистрирован ${siteConfig.legal.registeredAt}.`} />
          <div className="home-legal-details">
            <dl>
              <div><dt>ОГРН</dt><dd>{siteConfig.legal.ogrn}</dd></div>
              <div><dt>ИНН</dt><dd>{siteConfig.legal.inn}</dd></div>
            </dl>
            <p className="quiet-row">
              <Link href="/about">О фонде</Link>
              <Link href="/requisites">Полные реквизиты фонда</Link>
              <Link href="/reports">Отчёты фонда</Link>
              <Link href="/donation-offer">Оферта пожертвования</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="contact-band">
        <div className="container contact-band-inner">
          <div><h2>Напишите нам</h2><p>По вопросам помощи, участия и деятельности фонда.</p></div>
          <Link className="button button-light" href={siteConfig.contacts.formHref}>Связаться с фондом</Link>
        </div>
      </section>
    </>
  );
}

export default async function HomePage() {
  const evidence = await loadHomeEvidence();
  return renderHomePage({ ...defaultDependencies, evidence });
}
