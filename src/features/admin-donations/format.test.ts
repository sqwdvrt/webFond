import { describe, expect, it } from "vitest";

import {
  DONATION_STATUS_LABELS,
  formatDonationAmount,
  formatDonationCsvAmount,
  formatDonationCsvDateTime,
  formatDonationDateTime,
} from "./format";

describe("donation formatting", () => {
  it("formats integer kopecks without floating-point rounding", () => {
    expect(formatDonationAmount(1234567, "RUB")).toBe("12 345,67 RUB");
    expect(formatDonationAmount(-5, "USD")).toBe("-0,05 USD");
    expect(formatDonationCsvAmount(1234567)).toBe("12345,67");
  });

  it("defines Russian labels for every status", () => {
    expect(DONATION_STATUS_LABELS).toEqual({
      PENDING: "Ожидает",
      SUCCEEDED: "Успешно",
      CANCELED: "Отменено",
    });
  });

  it("formats modern Moscow timestamps", () => {
    const date = new Date("2026-08-23T09:34:56.000Z");

    expect(formatDonationDateTime(date)).toBe("23.08.2026, 12:34");
    expect(formatDonationCsvDateTime(date)).toBe(
      "2026-08-23 12:34:56 +03:00",
    );
  });

  it("uses the historical IANA offset", () => {
    expect(
      formatDonationCsvDateTime(new Date("2010-03-28T20:30:00.000Z")),
    ).toBe("2010-03-29 00:30:00 +04:00");
  });

  it("keeps nullable timestamps empty", () => {
    expect(formatDonationCsvDateTime(null)).toBe("");
  });
});
