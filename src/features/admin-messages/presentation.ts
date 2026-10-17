import type { ContactStatusValue } from "./types";

export const CONTACT_STATUS_LABELS: Record<ContactStatusValue, string> = {
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыто",
  SPAM: "Спам",
};

export const CONTACT_REPLY_SUBJECT = "Ответ фонда «Быть Добру»";

export function contactEmailHref(email: string) {
  return `mailto:${encodeURIComponent(email).replaceAll("%40", "@")}`;
}

export function contactReplyHref(email: string) {
  return `${contactEmailHref(email)}?subject=${encodeURIComponent(CONTACT_REPLY_SUBJECT)}`;
}

export function contactExcerpt(message: string, limit = 180) {
  const normalized = message.replace(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

  return characters.length > safeLimit
    ? `${characters.slice(0, safeLimit).join("")}…`
    : normalized;
}
