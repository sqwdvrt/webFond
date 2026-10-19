import { redirect } from "next/navigation";

import {
  buildContactQuery,
  parseContactPageFilters,
} from "@/features/admin-messages/filters";
import { getContactRequestPage } from "@/features/admin-messages/repository";
import type {
  ContactPageFilters,
  ParseResult,
  SearchParamsInput,
} from "@/features/admin-messages/types";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { InvalidMessageFilters, MessagesView } from "./messages-view";

export const dynamic = "force-dynamic";

type MessagesPageDependencies = {
  requireSession: () => Promise<unknown>;
  parseFilters: (input: SearchParamsInput) => ParseResult<ContactPageFilters>;
  getPage: typeof getContactRequestPage;
  navigate: (path: string) => never;
};

const defaultDependencies: MessagesPageDependencies = {
  requireSession: requireAdminSession,
  parseFilters: parseContactPageFilters,
  getPage: getContactRequestPage,
  navigate: redirect,
};

export async function renderMessagesPage(
  searchParams: SearchParamsInput,
  dependencies: MessagesPageDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const parsed = dependencies.parseFilters(searchParams);

  if (!parsed.ok) return <InvalidMessageFilters />;

  const result = await dependencies.getPage(parsed.value);
  if (result.page !== parsed.value.page) {
    const query = buildContactQuery({ ...parsed.value, page: result.page });
    dependencies.navigate(`/admin/messages${query.size ? `?${query}` : ""}`);
  }

  return <MessagesView key={JSON.stringify([parsed.value, result.rows.map((row) => [row.id, row.updatedAt])])} filters={parsed.value} result={result} />;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderMessagesPage(await searchParams);
}
