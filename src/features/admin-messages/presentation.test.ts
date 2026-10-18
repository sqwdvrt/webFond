import { describe, expect, it } from "vitest";

import {
  CONTACT_REPLY_SUBJECT,
  CONTACT_STATUS_LABELS,
  contactEmailHref,
  contactExcerpt,
  contactReplyHref,
  paginationItems,
} from "./presentation";

describe("contact presentation", () => {
  it("defines the canonical Russian labels for every contact status", () => {
    expect(CONTACT_STATUS_LABELS).toEqual({
      NEW: "Новое",
      IN_PROGRESS: "В работе",
      CLOSED: "Закрыто",
      SPAM: "Спам",
    });
  });

  it("encodes reserved email characters without allowing mailto headers", () => {
    expect(contactEmailHref("victim?subject=x&body=y@example.org")).toBe(
      "mailto:victim%3Fsubject%3Dx%26body%3Dy@example.org",
    );
  });

  it("creates a reply link with only the fixed foundation subject", () => {
    expect(CONTACT_REPLY_SUBJECT).toBe("Ответ фонда «Быть Добру»");
    expect(contactReplyHref("victim?subject=x@example.org")).toBe(
      `mailto:victim%3Fsubject%3Dx@example.org?subject=${encodeURIComponent("Ответ фонда «Быть Добру»")}`,
    );
  });

  it("normalizes whitespace and trims the excerpt", () => {
    expect(contactExcerpt("  Первая\n\t строка\u00a0\u2003 вторая  ")).toBe(
      "Первая строка вторая",
    );
  });

  it("counts Unicode code points and appends an ellipsis only past the default limit", () => {
    expect(contactExcerpt("😀".repeat(180))).toBe("😀".repeat(180));
    expect(contactExcerpt("😀".repeat(181))).toBe(`${"😀".repeat(180)}…`);
  });

  it("returns the only page when there is one page", () => {
    expect(paginationItems(1, 1)).toEqual([{ type: "page", page: 1 }]);
  });

  it("returns every page when there are at most seven pages", () => {
    expect(paginationItems(4, 7)).toEqual(
      Array.from({ length: 7 }, (_, index) => ({ type: "page", page: index + 1 })),
    );
  });

  it("places stable ellipses around the current page window", () => {
    expect(paginationItems(5, 10)).toEqual([
      { type: "page", page: 1 },
      { type: "ellipsis", key: "start" },
      { type: "page", page: 3 },
      { type: "page", page: 4 },
      { type: "page", page: 5 },
      { type: "page", page: 6 },
      { type: "page", page: 7 },
      { type: "ellipsis", key: "end" },
      { type: "page", page: 10 },
    ]);
  });

  it("normalizes impossible pagination input without emitting invalid pages", () => {
    expect(paginationItems(-12, 3)).toEqual([
      { type: "page", page: 1 },
      { type: "page", page: 2 },
      { type: "page", page: 3 },
    ]);
    expect(paginationItems(99, 2).every((item) => item.type !== "page" || item.page <= 2)).toBe(
      true,
    );
  });
});
