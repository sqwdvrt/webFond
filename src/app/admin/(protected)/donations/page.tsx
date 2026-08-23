import { redirect } from "next/navigation";

import {
  buildDonationQuery,
  parseDonationPageFilters,
} from "@/features/admin-donations/filters";
import { getDonationPage } from "@/features/admin-donations/repository";
import type {
  DonationPageFilters,
  ParseResult,
  SearchParamsInput,
} from "@/features/admin-donations/types";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { DonationsView, InvalidDonationFilters } from "./donations-view";

export const dynamic = "force-dynamic";

type DonationsPageDependencies = {
  requireSession: () => Promise<unknown>;
  parseFilters: (
    input: SearchParamsInput,
  ) => ParseResult<DonationPageFilters>;
  getPage: typeof getDonationPage;
  navigate: (path: string) => never;
};

const defaultDependencies: DonationsPageDependencies = {
  requireSession: requireAdminSession,
  parseFilters: parseDonationPageFilters,
  getPage: getDonationPage,
  navigate: redirect,
};

export async function renderDonationsPage(
  searchParams: SearchParamsInput,
  dependencies: DonationsPageDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const parsed = dependencies.parseFilters(searchParams);

  if (!parsed.ok) return <InvalidDonationFilters />;

  const result = await dependencies.getPage(parsed.value);
  if (result.page !== parsed.value.page) {
    const query = buildDonationQuery({ ...parsed.value, page: result.page });
    dependencies.navigate(`/admin/donations?${query}`);
  }

  return <DonationsView filters={parsed.value} result={result} />;
}

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderDonationsPage(await searchParams);
}
