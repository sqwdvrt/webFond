import type { Metadata } from "next";

import { PageHero } from "@/components/content/page-hero";
import { DonationForm } from "@/components/donation/donation-form";
import { DonationPreview } from "@/components/donation/donation-preview";
import { readPaymentsAvailability } from "@/features/payments/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Помочь фонду",
  description:
    "Способы участия и подготовка разового пожертвования через СБП.",
  alternates: { canonical: "/help" },
};

type HelpPageDependencies = {
  paymentsEnabled: () => boolean;
};

const defaultDependencies: HelpPageDependencies = {
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

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
        title="Разовая помощь через СБП"
        description={
          enabled
            ? "Можно сделать разовое пожертвование через СБП. Подписок, автосписаний и сохранения карты нет."
            : "Подключение оплаты через СБП готовится. Подписок, автосписаний и сохранения карты не будет."
        }
      />
      <section className="page-section">
        <div className="container text-grid">
          <div>
            <span className="section-number">01 Пожертвование</span>
          </div>
          {enabled ? <DonationForm /> : <DonationPreview />}
        </div>
      </section>
      <section className="page-section surface-band">
        <div className="container text-grid">
          <div>
            <span className="section-number">02 Другие способы</span>
          </div>
          <div className="prose">
            <h2>Участие без платежа</h2>
            <p>
              Информация о волонтерстве, партнерстве и информационной поддержке
              готовится к публикации.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function HelpPage() {
  return renderHelpPage();
}
