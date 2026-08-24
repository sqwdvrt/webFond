import type { Metadata } from "next";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";
import {
  getPublishedRequisites,
  type PublishedRequisitesResult,
} from "@/features/content-admin/repository";
import type { RequisitesInput } from "@/features/content-admin/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Реквизиты",
  description: "Подтвержденные юридические сведения фонда «Быть Добру».",
  alternates: { canonical: "/requisites" },
};

type RequisitesPageDependencies = {
  getRequisites: () => Promise<PublishedRequisitesResult>;
};

const defaultDependencies: RequisitesPageDependencies = {
  getRequisites: getPublishedRequisites,
};

type RequisitesRow = readonly [term: string, value: ReactNode];

function emailLink(email: string) {
  return <a href={`mailto:${email}`}>{email}</a>;
}

function confirmedLegalRows(): RequisitesRow[] {
  return [
    ["Полное наименование", siteConfig.name],
    ["Сокращенное наименование", siteConfig.shortName],
    ["ОГРН", siteConfig.legal.ogrn],
    ["ИНН", siteConfig.legal.inn],
    ["КПП", siteConfig.legal.kpp],
    ["Адрес", siteConfig.legal.address],
    ["Email", emailLink(siteConfig.legal.email)],
  ];
}

function publishedRows(requisites: RequisitesInput): RequisitesRow[] {
  return [
    ["Полное наименование", requisites.fullName],
    ["Сокращенное наименование", requisites.shortName],
    ["ОГРН", requisites.ogrn],
    ["ИНН", requisites.inn],
    ["КПП", requisites.kpp],
    ["Адрес", requisites.address],
    ["Email", emailLink(requisites.email)],
    ["Банк", requisites.bankName],
    ["Получатель", requisites.recipientName],
    ["Расчетный счет", requisites.checkingAccount],
    ["Корреспондентский счет", requisites.correspondentAccount],
    ["БИК", requisites.bik],
  ];
}

export async function renderRequisitesPage(
  dependencies: RequisitesPageDependencies = defaultDependencies,
) {
  let result: PublishedRequisitesResult | null;

  try {
    result = await dependencies.getRequisites();
  } catch {
    result = null;
  }

  const published = result?.status === "published" ? result.value : null;
  const rows = published ? publishedRows(published) : confirmedLegalRows();

  return (
    <>
      <PageHero
        eyebrow="Реквизиты"
        title="Сведения о фонде"
        description="На странице указаны только подтвержденные регистрационные данные."
      />
      <section className="page-section">
        <div className="container requisites-layout">
          <dl className="requisites-list">
            {rows.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {published ? null : result === null ? (
            <p className="status-note" role="status">
              Банковские реквизиты временно недоступны. Попробуйте обновить страницу позже.
            </p>
          ) : (
            <EmptyState
              title="Банковские реквизиты готовятся к публикации"
              description="Они появятся после подтверждения владельцем фонда."
            />
          )}
        </div>
      </section>
    </>
  );
}

export default function RequisitesPage() {
  return renderRequisitesPage();
}
