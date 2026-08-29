import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/content/page-hero";
import { DonationForm } from "@/components/donation/donation-form";
import { DonationPreview } from "@/components/donation/donation-preview";
import { readPaymentsAvailability } from "@/features/payments/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Помочь фонду",
  description: "Поддержать фонд «Быть Добру». Пожертвование через СБП.",
  alternates: { canonical: "/help" },
};

type HelpPageDependencies = {
  paymentsEnabled: () => boolean;
};

const defaultDependencies: HelpPageDependencies = {
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

const trustItems = [
  {
    title: "Система быстрых платежей",
    text: "Пожертвование переводится разово через СБП.",
  },
  {
    title: "Платежные данные",
    text: "Реквизиты карты обрабатывает платежный сервис. Фонд их не хранит.",
  },
  {
    title: "Разовый перевод",
    text: "Пожертвование не предполагает подписку и автоматические списания.",
  },
  {
    title: "Оферта",
    text: "Перед оплатой необходимо принять опубликованную оферту пожертвования.",
    href: "/donation-offer",
    linkLabel: "Читать оферту",
  },
] as const;

export function renderHelpPage(
  dependencies: HelpPageDependencies = defaultDependencies,
) {
  let enabled = false;
  try {
    enabled = dependencies.paymentsEnabled();
  } catch {
    enabled = false;
  }

  return (
    <>
      <PageHero
        eyebrow="Помочь фонду"
        title="Поддержать фонд"
        description={
          enabled
            ? "Разовое пожертвование через СБП."
            : "Онлайн-пожертвования скоро будут доступны. Пока можно помочь по реквизитам или написать фонду."
        }
      />
      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <h2>Пожертвование</h2>
              <p>
                {enabled
                  ? "Выберите сумму и перейдите к оплате через СБП. Платеж разовый, без подписки."
                  : "Когда оплата будет подключена, здесь появится форма: сумма, согласие, оферта и кнопка оплаты."}
              </p>
            </div>
          </div>
          <div className="help-layout">
            {enabled ? <DonationForm /> : <DonationPreview />}
            <div className="trust-grid">
              {trustItems.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  {"href" in item ? <Link href={item.href}>{item.linkLabel}</Link> : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">02</span>
          </div>
          <div className="prose">
            <h2>Другие формы участия</h2>
            <p>
              Поддержать фонд можно по реквизитам, письмом или как волонтер и партнер.
            </p>
            <p className="quiet-row">
              <Link href="/requisites">Банковские реквизиты</Link>
              <Link href="/need-help">Частые вопросы</Link>
            </p>
            <Link className="button button-secondary" href="/contacts">
              Написать фонду
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default function HelpPage() {
  return renderHelpPage();
}
