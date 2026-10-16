import { describe, expect, it } from "vitest";

import {
  moscowDateRange,
  moscowDayInterval,
  moscowMonthInterval,
  moscowStartOfDate,
  parseCalendarDate,
} from "./moscow";

describe("Moscow calendar boundaries", () => {
  it.each([
    ["2026-01-01", { year: 2026, month: 1, day: 1 }],
    ["2024-02-29", { year: 2024, month: 2, day: 29 }],
  ])("parses the valid calendar date %s", (value, expected) => {
    expect(parseCalendarDate(value)).toEqual(expected);
  });

  it.each([
    "2023-02-29",
    "2026-02-30",
    "2026-00-10",
    "2026-13-01",
    "2026-01-00",
    "2026-01-32",
    "26-01-01",
    "2026-1-01",
    "2026-01-1",
    "not-a-date",
  ])("rejects the invalid calendar date %s", (value) => {
    expect(parseCalendarDate(value)).toBeNull();
  });

  it("resolves midnight using Moscow's offset on that date", () => {
    expect(
      moscowStartOfDate({ year: 2010, month: 3, day: 28 }).toISOString(),
    ).toBe("2010-03-27T21:00:00.000Z");
    expect(
      moscowStartOfDate({ year: 2010, month: 3, day: 29 }).toISOString(),
    ).toBe("2010-03-28T20:00:00.000Z");
  });

  it("maps a skipped Moscow midnight to the first instant of that date", () => {
    expect(
      moscowStartOfDate({ year: 1981, month: 4, day: 1 }).toISOString(),
    ).toBe("1981-03-31T21:00:00.000Z");
  });

  it("keeps both boundaries around an ambiguous 2010 clock transition", () => {
    expect(moscowDayInterval(new Date("2010-10-31T12:00:00.000Z"))).toEqual({
      start: new Date("2010-10-30T20:00:00.000Z"),
      end: new Date("2010-10-31T21:00:00.000Z"),
    });
  });

  it.each([
    [
      "immediately before midnight",
      "2026-10-15T20:59:59.999Z",
      "2026-10-14T21:00:00.000Z",
      "2026-10-15T21:00:00.000Z",
    ],
    [
      "at midnight",
      "2026-10-15T21:00:00.000Z",
      "2026-10-15T21:00:00.000Z",
      "2026-10-16T21:00:00.000Z",
    ],
    [
      "immediately after midnight",
      "2026-10-15T21:00:00.001Z",
      "2026-10-15T21:00:00.000Z",
      "2026-10-16T21:00:00.000Z",
    ],
  ])("builds the local day interval %s", (_label, instant, start, end) => {
    expect(moscowDayInterval(new Date(instant))).toEqual({
      start: new Date(start),
      end: new Date(end),
    });
  });

  it("rolls a day interval into the next month and year", () => {
    expect(moscowDayInterval(new Date("2026-12-31T21:00:00.000Z"))).toEqual({
      start: new Date("2026-12-31T21:00:00.000Z"),
      end: new Date("2027-01-01T21:00:00.000Z"),
    });
  });

  it("builds a leap-day interval", () => {
    expect(moscowDayInterval(new Date("2024-02-29T12:00:00.000Z"))).toEqual({
      start: new Date("2024-02-28T21:00:00.000Z"),
      end: new Date("2024-02-29T21:00:00.000Z"),
    });
  });

  it("builds a local month interval across a year boundary", () => {
    expect(
      moscowMonthInterval(new Date("2026-12-31T21:00:00.000Z")),
    ).toEqual({
      start: new Date("2026-12-31T21:00:00.000Z"),
      end: new Date("2027-01-31T21:00:00.000Z"),
    });
  });

  it("treats an inclusive same-day range as one half-open day", () => {
    expect(moscowDateRange("2026-08-23", "2026-08-23")).toEqual({
      fromUtc: new Date("2026-08-22T21:00:00.000Z"),
      toExclusiveUtc: new Date("2026-08-23T21:00:00.000Z"),
    });
  });

  it("supports open date ranges", () => {
    expect(moscowDateRange("2026-08-23", undefined)).toEqual({
      fromUtc: new Date("2026-08-22T21:00:00.000Z"),
    });
    expect(moscowDateRange(undefined, "2026-08-23")).toEqual({
      toExclusiveUtc: new Date("2026-08-23T21:00:00.000Z"),
    });
    expect(moscowDateRange(undefined, undefined)).toEqual({});
  });

  it.each([
    ["2026-02-30", undefined],
    [undefined, "2026-02-30"],
    ["2026-08-24", "2026-08-23"],
  ])("rejects an invalid or reversed range", (from, to) => {
    expect(moscowDateRange(from, to)).toBeNull();
  });
});
