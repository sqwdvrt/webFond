import type { Prisma } from "@prisma/client";

import { siteConfig } from "@/config/site";

import {
  PUBLICATION_STATUSES,
  type DocumentInput,
  type EditorialInput,
  type ParseResult,
  type PublicationStatus,
  type RequisitesInput,
  type ValidationResult,
} from "./types";

const DUPLICATE_ERROR = "Поле должно быть указано один раз";
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_URL_LENGTH = 2048;
const REQUISITES_FIELDS = [
  "version",
  "status",
  "fullName",
  "shortName",
  "ogrn",
  "inn",
  "kpp",
  "address",
  "email",
  "bankName",
  "recipientName",
  "checkingAccount",
  "correspondentAccount",
  "bik",
] as const;

type RequisitesField = (typeof REQUISITES_FIELDS)[number];

type Fields<T extends string> = Record<T, string>;
type FieldErrors<T extends string> = Partial<Record<T, string>>;

function readFields<const T extends string>(
  formData: FormData,
  names: readonly T[],
): { values: Fields<T>; errors: FieldErrors<T> } {
  const values = {} as Fields<T>;
  const errors: FieldErrors<T> = {};

  for (const name of names) {
    const entries = formData.getAll(name);
    if (entries.length > 1) errors[name] = DUPLICATE_ERROR;

    const first = entries[0];
    if (first !== undefined && typeof first !== "string") {
      errors[name] ??= "Введите текстовое значение";
    }
    values[name] = typeof first === "string" ? first.trim() : "";
  }

  return { values, errors };
}

function setError<T extends string>(
  errors: FieldErrors<T>,
  field: T,
  message: string,
) {
  errors[field] ??= message;
}

function hasLength(value: string, minimum: number, maximum: number) {
  return value.length >= minimum && value.length <= maximum;
}

function isPublicationStatus(value: string): value is PublicationStatus {
  return PUBLICATION_STATUSES.includes(value as PublicationStatus);
}

function isSafeUrl(value: string) {
  if (
    !value ||
    value.length > MAX_URL_LENGTH ||
    value.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return false;
  }

  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function parseEditorialForm(
  formData: FormData,
): ValidationResult<EditorialInput> {
  const { values, errors } = readFields(formData, [
    "title",
    "slug",
    "summary",
    "content",
    "imageUrl",
    "status",
  ] as const);

  if (!hasLength(values.title, 2, 160)) {
    setError(errors, "title", "Введите от 2 до 160 символов");
  }
  if (
    !hasLength(values.slug, 2, 120) ||
    !SLUG_PATTERN.test(values.slug)
  ) {
    setError(
      errors,
      "slug",
      "Введите адрес из строчных латинских букв, цифр и одиночных дефисов",
    );
  }
  if (values.summary.length > 500) {
    setError(errors, "summary", "Введите не более 500 символов");
  }
  if (values.content.length > 20_000) {
    setError(errors, "content", "Введите не более 20000 символов");
  }
  if (values.imageUrl && !isSafeUrl(values.imageUrl)) {
    setError(errors, "imageUrl", "Введите безопасный локальный или HTTPS-адрес");
  }
  if (!isPublicationStatus(values.status)) {
    setError(errors, "status", "Выберите допустимый статус");
  }

  if (values.status === "PUBLISHED") {
    if (!hasLength(values.summary, 10, 500)) {
      setError(errors, "summary", "Для публикации введите от 10 до 500 символов");
    }
    if (!hasLength(values.content, 20, 20_000)) {
      setError(errors, "content", "Для публикации введите от 20 до 20000 символов");
    }
  }

  const normalizedValues = {
    title: values.title,
    slug: values.slug,
    summary: values.summary || null,
    content: values.content || null,
    imageUrl: values.imageUrl || null,
    status: values.status,
  };

  if (Object.keys(errors).length > 0 || !isPublicationStatus(values.status)) {
    return { ok: false, errors, values: normalizedValues };
  }

  return { ok: true, value: { ...normalizedValues, status: values.status } };
}

export function parseDocumentForm(
  formData: FormData,
): ValidationResult<DocumentInput> {
  const { values, errors } = readFields(formData, [
    "title",
    "category",
    "fileUrl",
    "status",
  ] as const);

  if (!hasLength(values.title, 2, 160)) {
    setError(errors, "title", "Введите от 2 до 160 символов");
  }
  if (!hasLength(values.category, 2, 80)) {
    setError(errors, "category", "Введите от 2 до 80 символов");
  }
  if (!isSafeUrl(values.fileUrl)) {
    setError(errors, "fileUrl", "Введите безопасный локальный или HTTPS-адрес");
  }
  if (!isPublicationStatus(values.status)) {
    setError(errors, "status", "Выберите допустимый статус");
  }

  const normalizedValues = {
    title: values.title,
    category: values.category,
    fileUrl: values.fileUrl,
    status: values.status,
  };

  if (Object.keys(errors).length > 0 || !isPublicationStatus(values.status)) {
    return { ok: false, errors, values: normalizedValues };
  }

  return { ok: true, value: { ...normalizedValues, status: values.status } };
}

export function publicationTimestamp(
  status: PublicationStatus,
  existingPublishedAt: Date | null,
  now: Date,
): Date | null {
  if (existingPublishedAt) return existingPublishedAt;
  return status === "PUBLISHED" ? now : null;
}

function validateRequisites(
  values: Fields<RequisitesField>,
  initialErrors: FieldErrors<RequisitesField> = {},
) {
  const errors = { ...initialErrors };

  if (values.version !== "1") {
    setError(errors, "version", "Версия реквизитов не поддерживается");
  }
  if (!isPublicationStatus(values.status)) {
    setError(errors, "status", "Выберите допустимый статус");
  }
  if (!hasLength(values.fullName, 2, 240)) {
    setError(errors, "fullName", "Введите от 2 до 240 символов");
  }
  if (!hasLength(values.shortName, 2, 160)) {
    setError(errors, "shortName", "Введите от 2 до 160 символов");
  }
  if (!/^\d{13}$/.test(values.ogrn)) {
    setError(errors, "ogrn", "Введите ОГРН из 13 цифр");
  }
  if (!/^\d{10}$/.test(values.inn)) {
    setError(errors, "inn", "Введите ИНН из 10 цифр");
  }
  if (!/^\d{9}$/.test(values.kpp)) {
    setError(errors, "kpp", "Введите КПП из 9 цифр");
  }
  if (!hasLength(values.address, 5, 500)) {
    setError(errors, "address", "Введите от 5 до 500 символов");
  }

  const firstAt = values.email.indexOf("@");
  if (
    !hasLength(values.email, 3, 254) ||
    firstAt <= 0 ||
    firstAt !== values.email.lastIndexOf("@") ||
    firstAt === values.email.length - 1
  ) {
    setError(errors, "email", "Введите корректный email");
  }

  const bankRequired = values.status === "PUBLISHED";
  if (
    (bankRequired || values.bankName.length > 0) &&
    !hasLength(values.bankName, 2, 200)
  ) {
    setError(errors, "bankName", "Введите от 2 до 200 символов");
  }
  if (
    (bankRequired || values.recipientName.length > 0) &&
    !hasLength(values.recipientName, 2, 240)
  ) {
    setError(errors, "recipientName", "Введите от 2 до 240 символов");
  }
  if (
    (bankRequired || values.checkingAccount.length > 0) &&
    !/^\d{20}$/.test(values.checkingAccount)
  ) {
    setError(errors, "checkingAccount", "Введите расчетный счет из 20 цифр");
  }
  if (
    (bankRequired || values.correspondentAccount.length > 0) &&
    !/^\d{20}$/.test(values.correspondentAccount)
  ) {
    setError(
      errors,
      "correspondentAccount",
      "Введите корреспондентский счет из 20 цифр",
    );
  }
  if (
    (bankRequired || values.bik.length > 0) &&
    !/^\d{9}$/.test(values.bik)
  ) {
    setError(errors, "bik", "Введите БИК из 9 цифр");
  }

  return errors;
}

function normalizedRequisites(values: Fields<RequisitesField>) {
  return {
    version: values.version === "1" ? 1 : values.version,
    status: values.status,
    fullName: values.fullName,
    shortName: values.shortName,
    ogrn: values.ogrn,
    inn: values.inn,
    kpp: values.kpp,
    address: values.address,
    email: values.email,
    bankName: values.bankName,
    recipientName: values.recipientName,
    checkingAccount: values.checkingAccount,
    correspondentAccount: values.correspondentAccount,
    bik: values.bik,
  };
}

export function parseRequisitesForm(
  formData: FormData,
): ValidationResult<RequisitesInput> {
  const { values, errors: readErrors } = readFields(
    formData,
    REQUISITES_FIELDS,
  );
  const errors = validateRequisites(values, readErrors);
  const normalizedValues = normalizedRequisites(values);

  if (
    Object.keys(errors).length > 0 ||
    values.version !== "1" ||
    !isPublicationStatus(values.status)
  ) {
    return { ok: false, errors, values: normalizedValues };
  }

  return {
    ok: true,
    value: { ...normalizedValues, version: 1, status: values.status },
  };
}

export function defaultRequisitesDraft(): RequisitesInput {
  return {
    version: 1,
    status: "DRAFT",
    fullName: siteConfig.name,
    shortName: siteConfig.shortName,
    ogrn: siteConfig.legal.ogrn,
    inn: siteConfig.legal.inn,
    kpp: siteConfig.legal.kpp,
    address: siteConfig.legal.address,
    email: siteConfig.legal.email,
    bankName: "",
    recipientName: "",
    checkingAccount: "",
    correspondentAccount: "",
    bik: "",
  };
}

export function parseRequisitesSetting(
  input: Prisma.JsonValue,
): ParseResult<RequisitesInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false };
  }

  const entries = Object.entries(input);
  if (
    entries.length !== REQUISITES_FIELDS.length ||
    !REQUISITES_FIELDS.every((field) => Object.hasOwn(input, field)) ||
    input.version !== 1 ||
    REQUISITES_FIELDS.slice(1).some(
      (field) => typeof input[field] !== "string",
    )
  ) {
    return { ok: false };
  }

  const values = {} as Fields<RequisitesField>;
  values.version = "1";
  for (const field of REQUISITES_FIELDS.slice(1)) {
    values[field] = (input[field] as string).trim();
  }

  if (Object.keys(validateRequisites(values)).length > 0) {
    return { ok: false };
  }

  const normalized = normalizedRequisites(values);
  return {
    ok: true,
    value: {
      ...normalized,
      version: 1,
      status: values.status as PublicationStatus,
    },
  };
}
