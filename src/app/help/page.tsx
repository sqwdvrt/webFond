import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/content/page-hero";
import { BankQrTransfer } from "@/components/donation/bank-qr-transfer";
import { DonationForm } from "@/components/donation/donation-form";
import { DonationPreview } from "@/components/donation/donation-preview";
import { listPublishedProjectDonationOptions } from "@/features/fundraising/public-projects";
import { readPaymentsAvailability } from "@/features/payments/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Помочь фонду",
  description: "Поддержать фонд «Быть Добру». Пожертвование онлайн или по реквизитам.",
  alternates: { canonical: "/help" },
};

type HelpPageDependencies = {
  paymentsEnabled: () => boolean;
  projects?: Array<{ slug: string; title: string }>;
  initialProjectSlug?: string;
};

const defaultDependencies: HelpPageDependencies = {
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

function trustNote(paymentsEnabled: boolean) {
  const facts = [
    {
      title: "Платежные данные",
      text: paymentsEnabled
        ? "Реквизиты карты обрабатывает платежный сервис. Фонд их не хранит."
        : "Реквизиты карты будет обрабатывать платежный сервис. Фонд их не хранит.",
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

  return {
    heading: "Как устроена оплата",
    lead: paymentsEnabled
      ? "Оплата проходит на стороне ЮKassa. Доступны Система быстрых платежей (СБП) и банковская карта. Выберите способ на странице оплаты. Если выбран СБП, подтвердите платёж в приложении банка. QR-код СБП показывает ЮKassa после перехода, не на этой странице. Email нужен для кассового чека и передаётся в ЮKassa."
      : "Форма онлайн-оплаты появится после подключения платежного сервиса.",
    facts,
  };
}

export function renderHelpPage(
  dependencies: Partial<HelpPageDependencies> = {},
) {
  const { paymentsEnabled, projects = [], initialProjectSlug } = {
    ...defaultDependencies,
    ...dependencies,
  };
  let enabled = false;
  try {
    enabled = paymentsEnabled();
  } catch {
    enabled = false;
  }

  const note = trustNote(enabled);

  return (
    <>
      <PageHero
        eyebrow="Помочь фонду"
        title="Поддержать фонд"
        description={
          enabled
            ? "Пожертвование через ЮKassa. Платеж разовый, без подписки."
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
                  ? "Выберите сумму и перейдите к оплате на стороне ЮKassa. Платеж разовый, без подписки."
                  : "Когда оплата будет подключена, здесь появится форма: сумма, согласие, оферта и кнопка оплаты."}
              </p>
            </div>
          </div>
          <div className="help-layout">
            {enabled ? (
              <DonationForm
                initialProjectSlug={initialProjectSlug}
                projects={projects}
              />
            ) : (
              <DonationPreview />
            )}
            <aside className="trust-note">
              <h3>{note.heading}</h3>
              <p>{note.lead}</p>
              <ul>
                {note.facts.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span>
                      {item.text}
                      {"href" in item ? (
                        <>
                          {" "}
                          <Link href={item.href}>{item.linkLabel}</Link>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <h2>Перевод в приложении банка</h2>
              <p>
                Выберите свой банк. Откройте приложение, наведите камеру на код и укажите сумму.
                Если вашего банка нет в списке,{" "}
                <Link href="/requisites">переведите по реквизитам</Link>.
              </p>
            </div>
          </div>
          <BankQrTransfer />
        </div>
      </section>
      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">03</span>
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

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialProjectSlug =
    typeof params.project === "string" ? params.project : "";
  let projects: Array<{ slug: string; title: string }> = [];
  try {
    projects = await listPublishedProjectDonationOptions();
  } catch {
    projects = [];
  }

  return renderHelpPage({
    initialProjectSlug,
    projects,
  });
}
