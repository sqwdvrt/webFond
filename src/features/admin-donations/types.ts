export const DONATION_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "CANCELED",
] as const;

export type DonationStatusValue = (typeof DONATION_STATUSES)[number];

export type DonationExportFilters = {
  status?: DonationStatusValue;
  from?: string;
  to?: string;
  q?: string;
  fromUtc?: Date;
  toExclusiveUtc?: Date;
};

export type DonationPageFilters = DonationExportFilters & {
  page: number;
};

export type DonationRow = {
  id: string;
  providerPaymentId: string | null;
  amountKopecks: number;
  currency: string;
  status: DonationStatusValue;
  donorName: string | null;
  donorEmail: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export type DonationCursor = Pick<DonationRow, "createdAt" | "id">;

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;
