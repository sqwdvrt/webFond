import type { ContactStatusValue } from "./types";

export const CONTACT_STATUS_LABELS: Record<ContactStatusValue, string> = {
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыто",
  SPAM: "Спам",
};

export const CONTACT_REPLY_SUBJECT = "Ответ фонда «Быть Добру»";

export type PaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; key: "start" | "end" };

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

export function paginationItems(current: number, total: number): PaginationItem[] {
  const normalizedTotal = Math.max(1, Number.isFinite(total) ? Math.floor(total) : 1);
  const normalizedCurrent = Math.min(
    normalizedTotal,
    Math.max(1, Number.isFinite(current) ? Math.floor(current) : 1),
  );

  if (normalizedTotal <= 7) {
    return Array.from({ length: normalizedTotal }, (_, index) => ({
      type: "page" as const,
      page: index + 1,
    }));
  }

  const windowStart = Math.max(2, Math.min(normalizedCurrent - 2, normalizedTotal - 5));
  const windowEnd = Math.min(normalizedTotal - 1, windowStart + 4);
  const items: PaginationItem[] = [{ type: "page", page: 1 }];

  if (windowStart > 2) items.push({ type: "ellipsis", key: "start" });
  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push({ type: "page", page });
  }
  if (windowEnd < normalizedTotal - 1) items.push({ type: "ellipsis", key: "end" });
  items.push({ type: "page", page: normalizedTotal });

  return items;
}
