import type { Prisma } from "@prisma/client";

import { moscowDateRange } from "@/lib/dates/moscow";

import {
  CONTACT_STATUSES,
  type ContactFilters,
  type ContactPageFilters,
  type ContactStatusValue,
  type ParseResult,
  type SearchParamsInput,
} from "./types";

const PAGE_PATTERN = /^[1-9][0-9]{0,5}$/;
const MAX_QUERY_LENGTH = 120;

function valuesFor(input: SearchParamsInput, name: string) {
  if (input instanceof URLSearchParams) return input.getAll(name);

  const value = input[name];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function oneValue(input: SearchParamsInput, name: string) {
  const values = valuesFor(input, name);
  if (values.length > 1) return { ok: false } as const;
  return { ok: true, value: values[0]?.trim() || undefined } as const;
}

export function parseContactPageFilters(
  input: SearchParamsInput,
): ParseResult<ContactPageFilters> {
  const statusValue = oneValue(input, "status");
  const fromValue = oneValue(input, "from");
  const toValue = oneValue(input, "to");
  const queryValue = oneValue(input, "q");
  const pageValue = oneValue(input, "page");

  if (
    !statusValue.ok ||
    !fromValue.ok ||
    !toValue.ok ||
    !queryValue.ok ||
    !pageValue.ok
  ) {
    return { ok: false };
  }

  if (
    statusValue.value &&
    !CONTACT_STATUSES.includes(statusValue.value as ContactStatusValue)
  ) {
    return { ok: false };
  }
  if (queryValue.value && queryValue.value.length > MAX_QUERY_LENGTH) {
    return { ok: false };
  }
  if (pageValue.value && !PAGE_PATTERN.test(pageValue.value)) {
    return { ok: false };
  }

  const dateRange = moscowDateRange(fromValue.value, toValue.value);
  if (!dateRange) return { ok: false };

  return {
    ok: true,
    value: {
      ...(statusValue.value
        ? { status: statusValue.value as ContactStatusValue }
        : {}),
      ...(fromValue.value ? { from: fromValue.value } : {}),
      ...(toValue.value ? { to: toValue.value } : {}),
      ...(queryValue.value ? { q: queryValue.value } : {}),
      ...dateRange,
      page: Number(pageValue.value ?? "1"),
    },
  };
}

export function buildContactWhere(
  filters: ContactFilters,
): Prisma.ContactRequestWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.fromUtc || filters.toExclusiveUtc
      ? {
          createdAt: {
            ...(filters.fromUtc ? { gte: filters.fromUtc } : {}),
            ...(filters.toExclusiveUtc ? { lt: filters.toExclusiveUtc } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { message: { contains: filters.q, mode: "insensitive" } },
          ] satisfies Prisma.ContactRequestWhereInput[],
        }
      : {}),
  };
}

export function buildContactQuery(filters: ContactPageFilters) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.q) query.set("q", filters.q);
  if (filters.page !== 1) query.set("page", String(filters.page));
  return query;
}
