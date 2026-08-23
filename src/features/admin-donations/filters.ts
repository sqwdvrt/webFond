import type { Prisma } from "@prisma/client";

import {
  DONATION_STATUSES,
  type DonationExportFilters,
  type DonationPageFilters,
  type DonationStatusValue,
  type ParseResult,
  type SearchParamsInput,
} from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PAGE_PATTERN = /^[1-9][0-9]{0,5}$/;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const MAX_QUERY_LENGTH = 120;

const offsetFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function valuesFor(input: SearchParamsInput, name: string) {
  if (input instanceof URLSearchParams) {
    return input.getAll(name);
  }

  const value = input[name];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function oneValue(input: SearchParamsInput, name: string) {
  const values = valuesFor(input, name);
  if (values.length > 1) return { ok: false } as const;
  return { ok: true, value: values[0]?.trim() || undefined } as const;
}

function parseDateParts(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function nextCalendarDay(parts: { year: number; month: number; day: number }) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function offsetAt(date: Date) {
  const values = Object.fromEntries(
    offsetFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
  );
}

function moscowStart(parts: { year: number; month: number; day: number }) {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = localAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = localAsUtc - offsetAt(new Date(instant));
  }

  return new Date(instant);
}

function parseBaseFilters(
  input: SearchParamsInput,
): ParseResult<DonationExportFilters> {
  const statusValue = oneValue(input, "status");
  const fromValue = oneValue(input, "from");
  const toValue = oneValue(input, "to");
  const queryValue = oneValue(input, "q");

  if (
    !statusValue.ok ||
    !fromValue.ok ||
    !toValue.ok ||
    !queryValue.ok
  ) {
    return { ok: false };
  }

  if (
    statusValue.value &&
    !DONATION_STATUSES.includes(statusValue.value as DonationStatusValue)
  ) {
    return { ok: false };
  }
  if (queryValue.value && queryValue.value.length > MAX_QUERY_LENGTH) {
    return { ok: false };
  }

  const fromParts = fromValue.value ? parseDateParts(fromValue.value) : null;
  const toParts = toValue.value ? parseDateParts(toValue.value) : null;
  if ((fromValue.value && !fromParts) || (toValue.value && !toParts)) {
    return { ok: false };
  }

  const fromUtc = fromParts ? moscowStart(fromParts) : undefined;
  const toExclusiveUtc = toParts
    ? moscowStart(nextCalendarDay(toParts))
    : undefined;
  if (fromUtc && toExclusiveUtc && fromUtc >= toExclusiveUtc) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      ...(statusValue.value
        ? { status: statusValue.value as DonationStatusValue }
        : {}),
      ...(fromValue.value ? { from: fromValue.value, fromUtc } : {}),
      ...(toValue.value ? { to: toValue.value, toExclusiveUtc } : {}),
      ...(queryValue.value ? { q: queryValue.value } : {}),
    },
  };
}

export function parseDonationExportFilters(
  input: SearchParamsInput,
): ParseResult<DonationExportFilters> {
  return parseBaseFilters(input);
}

export function parseDonationPageFilters(
  input: SearchParamsInput,
): ParseResult<DonationPageFilters> {
  const base = parseBaseFilters(input);
  const pageValue = oneValue(input, "page");
  if (!base.ok || !pageValue.ok) return { ok: false };
  if (pageValue.value && !PAGE_PATTERN.test(pageValue.value)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: { ...base.value, page: Number(pageValue.value ?? "1") },
  };
}

export function buildDonationWhere(
  filters: DonationExportFilters,
): Prisma.DonationWhereInput {
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
            { donorName: { contains: filters.q, mode: "insensitive" } },
            { donorEmail: { contains: filters.q, mode: "insensitive" } },
            {
              providerPaymentId: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
          ] satisfies Prisma.DonationWhereInput[],
        }
      : {}),
  };
}

export function buildDonationQuery(
  filters: DonationExportFilters & { page?: number },
  options: { includePage?: boolean } = {},
) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.q) query.set("q", filters.q);
  if (options.includePage !== false && filters.page && filters.page !== 1) {
    query.set("page", String(filters.page));
  }
  return query;
}
