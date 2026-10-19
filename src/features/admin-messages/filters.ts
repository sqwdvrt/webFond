import type { Prisma } from "@prisma/client";

import { moscowDateRange } from "@/lib/dates/moscow";

import {
  CONTACT_STATUSES,
  CONTACT_FOLDERS,
  type ContactFolderValue,
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
  const folderValue = oneValue(input, "folder");
  const statusValue = oneValue(input, "status");
  const fromValue = oneValue(input, "from");
  const toValue = oneValue(input, "to");
  const queryValue = oneValue(input, "q");
  const pageValue = oneValue(input, "page");
  const beforeValue = oneValue(input, "before");

  if (
    !folderValue.ok ||
    !statusValue.ok ||
    !fromValue.ok ||
    !toValue.ok ||
    !queryValue.ok ||
    !pageValue.ok || !beforeValue.ok
  ) {
    return { ok: false };
  }

  if (folderValue.value && !CONTACT_FOLDERS.includes(folderValue.value as ContactFolderValue)) return { ok: false };
  if (
    statusValue.value &&
    statusValue.value !== "ACTIVE" &&
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
  if (beforeValue.value && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(beforeValue.value) ||
    !Number.isFinite(Date.parse(beforeValue.value)) || new Date(beforeValue.value).toISOString() !== beforeValue.value)) return { ok: false };

  return {
    ok: true,
    value: {
      ...(folderValue.value ? { folder: folderValue.value as ContactFolderValue } : {}),
      ...(statusValue.value
        ? { status: statusValue.value as ContactPageFilters["status"] }
        : {}),
      ...(fromValue.value ? { from: fromValue.value } : {}),
      ...(toValue.value ? { to: toValue.value } : {}),
      ...(queryValue.value ? { q: queryValue.value } : {}),
      ...dateRange,
      ...(beforeValue.value ? { before: beforeValue.value } : {}),
      page: Number(pageValue.value ?? "1"),
    },
  };
}

export function buildContactWhere(
  filters: ContactFilters,
): Prisma.ContactRequestWhereInput {
  return {
    folder: filters.folder ?? "INBOX",
    ...(filters.status ? { status: filters.status === "ACTIVE" ? { in: ["NEW", "IN_PROGRESS"] } : filters.status } : {}),
    ...(filters.fromUtc || filters.toExclusiveUtc || filters.before
      ? {
          createdAt: {
            ...(filters.fromUtc ? { gte: filters.fromUtc } : {}),
            ...((filters.toExclusiveUtc || filters.before) ? { lt: new Date(Math.min(filters.toExclusiveUtc?.getTime() ?? Infinity, filters.before ? Date.parse(filters.before) : Infinity)) } : {}),
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
  if (filters.folder && filters.folder !== "INBOX") query.set("folder", filters.folder);
  if (filters.status) query.set("status", filters.status);
  if (filters.before) query.set("before", filters.before);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.q) query.set("q", filters.q);
  if (filters.page !== 1) query.set("page", String(filters.page));
  return query;
}

export function safeMessagesReturnTo(value: unknown): string {
  if (typeof value !== "string" || !/^\/admin\/messages(?:\?|$)/.test(value) || /[\\#\x00-\x20]/.test(value)) return "/admin/messages";
  const query = new URLSearchParams(value.split("?")[1]);
  if ([...query.keys()].some((key) => !["status", "from", "to", "q", "page", "before", "folder"].includes(key))) return "/admin/messages";
  const parsed = parseContactPageFilters(query);
  if (!parsed.ok) return "/admin/messages";
  const canonical = buildContactQuery(parsed.value);
  return `/admin/messages${canonical.size ? `?${canonical}` : ""}`;
}
