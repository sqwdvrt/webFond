import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/content/faq-list";
import { PageHero } from "@/components/content/page-hero";
import { BankQrTransfer } from "@/components/donation/bank-qr-transfer";
import { DonationForm } from "@/components/donation/donation-form";
import { DonationPreview } from "@/components/donation/donation-preview";
import { listPublishedProjectDonationOptions } from "@/features/fundraising/public-projects";
import { donorFaqItems } from "@/content/faq";
import { siteConfig } from "@/config/site";
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


  return (
    <>
      <PageHero
        compact
        eyebrow="Помочь фонду"
        title="Поддержать фонд"
      />
      <section className="page-section">
        <div className="container donation-content">
          <div id="online-donation" className="anchor-target">{enabled ? (
            <DonationForm initialProjectSlug={initialProjectSlug} projects={projects} />
          ) : <DonationPreview />}</div>
          <section className="bank-transfer-content anchor-target" id="bank-transfer" aria-labelledby="bank-transfer-title">
            <h2 id="bank-transfer-title">Перевод в приложении банка</h2>
            <p>Выберите банковский счёт фонда, откройте QR-код и укажите сумму пожертвования.</p>
            <BankQrTransfer />
          </section>
        </div>
      </section>
      <section className="page-section" id="donation-faq">
        <div className="container donation-content">
          <div className="section-heading section-heading-plain"><div><h2>Вопросы о пожертвовании</h2></div></div>
          <FaqList items={donorFaqItems} />
          <p className="quiet-row"><Link href="/reports">Отчёты фонда</Link></p>
        </div>
      </section>
      <section className="page-section surface-band anchor-target" id="other-help">
        <div className="container donation-content prose">
          <h2>Другие формы участия</h2>
          <p>Можно предложить помощь вещами, время и навыки или сотрудничество с вашей организацией. Напишите, как вы готовы участвовать.</p>
          <Link className="button button-secondary" href={siteConfig.contacts.formHref}>Написать фонду</Link>
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
