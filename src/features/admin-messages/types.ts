export const CONTACT_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "CLOSED",
  "SPAM",
] as const;

export type ContactStatusValue = (typeof CONTACT_STATUSES)[number];

export type ContactFilters = {
  status?: ContactStatusValue | "ACTIVE";
  before?: string;
  from?: string;
  to?: string;
  q?: string;
  fromUtc?: Date;
  toExclusiveUtc?: Date;
};

export type ContactPageFilters = ContactFilters & {
  page: number;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;
