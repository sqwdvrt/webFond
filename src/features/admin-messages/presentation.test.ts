import { describe, expect, it } from "vitest";

import {
  CONTACT_REPLY_SUBJECT,
  CONTACT_STATUS_LABELS,
  contactEmailHref,
  contactExcerpt,
  contactReplyHref,
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
});
