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

function trustNote() {
  const facts = [
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

  return {
    heading: "Как устроена оплата",
    lead: "Оплата проходит на стороне ЮKassa. Доступны Система быстрых платежей (СБП) и банковская карта. Выберите способ на странице оплаты. Если выбран СБП, подтвердите платёж в приложении банка. QR-код СБП показывает ЮKassa после перехода, не на этой странице. Email нужен для кассового чека и передаётся в ЮKassa.",
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

  const note = trustNote();

  return (
    <>
      <PageHero
        eyebrow="Помочь фонду"
        title="Поддержать фонд"
        description={
          enabled
            ? "Пожертвование через ЮKassa. Платеж разовый, без подписки."
            : "Поддержать фонд можно банковским переводом. Выберите банк или воспользуйтесь реквизитами."
        }
      />
      {enabled ? (
        <section className="page-section">
          <div className="container">
            <div className="section-heading">
              <span className="section-number">01</span>
              <div>
                <h2>Пожертвование</h2>
                <p>
                  Выберите сумму и перейдите к оплате на стороне ЮKassa. Платеж разовый, без подписки.
                </p>
              </div>
            </div>
            <div className="help-layout">
              <DonationForm
                initialProjectSlug={initialProjectSlug}
                projects={projects}
              />
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
      ) : null}
      <section className="page-section">
        <div className="container">
          <div className="section-heading">
            <span className="section-number">{enabled ? "02" : "01"}</span>
            <div>
              <h2>Перевод в приложении банка</h2>
              <p>
                Выберите свой банк. С компьютера отсканируйте код телефоном,
                с телефона сохраните QR и откройте его в приложении банка. Укажите сумму перевода.
                Если вашего банка нет в списке,{" "}
                <Link href="/requisites">переведите по реквизитам</Link>.
              </p>
            </div>
          </div>
          {!enabled ? <DonationPreview /> : null}
          <BankQrTransfer />
        </div>
      </section>
      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">{enabled ? "03" : "02"}</span>
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
