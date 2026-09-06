export const PUBLICATION_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export type EditorialInput = {
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  status: PublicationStatus;
};

export type ProjectInput = EditorialInput & {
  goalAmountKopecks: number | null;
  manualRaisedKopecks: number;
};

export type DocumentInput = {
  title: string;
  category: string;
  fileUrl: string;
  status: PublicationStatus;
};

export type RequisitesInput = {
  version: 1;
  status: PublicationStatus;
  fullName: string;
  shortName: string;
  ogrn: string;
  inn: string;
  kpp: string;
  address: string;
  email: string;
  bankName: string;
  recipientName: string;
  checkingAccount: string;
  correspondentAccount: string;
  bik: string;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

type FieldName<T> = Extract<keyof T, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      errors: Partial<Record<FieldName<T>, string>>;
      values: Partial<Record<FieldName<T>, string | number | null>>;
    };
