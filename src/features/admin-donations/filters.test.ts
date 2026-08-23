import { describe, expect, it } from "vitest";

import {
  buildDonationQuery,
  buildDonationWhere,
  parseDonationExportFilters,
  parseDonationPageFilters,
} from "./filters";

function expectValid<T>(result: { ok: true; value: T } | { ok: false }) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid filters");
  return result.value;
}

describe("donation filters", () => {
  it("normalizes valid page filters and serializes them", () => {
    const filters = expectValid(
      parseDonationPageFilters(
        new URLSearchParams(
          "status=SUCCEEDED&from=2026-08-01&to=2026-08-23&q=%20ivan%40mail.ru%20&page=2",
        ),
      ),
    );

    expect(filters).toMatchObject({
      status: "SUCCEEDED",
      from: "2026-08-01",
      to: "2026-08-23",
      q: "ivan@mail.ru",
      page: 2,
    });
    expect(buildDonationQuery(filters).toString()).toBe(
      "status=SUCCEEDED&from=2026-08-01&to=2026-08-23&q=ivan%40mail.ru&page=2",
    );
  });

  it("treats blank filters as absent", () => {
    expectValid(
      parseDonationPageFilters(
        new URLSearchParams("status=&from=+&to=&q=++&page="),
      ),
    );
  });

  it.each([
    "status=PAID",
    "from=2026-02-30",
    "to=23.08.2026",
    "from=2026-08-24&to=2026-08-23",
    `q=${"x".repeat(121)}`,
    "page=0",
    "page=01",
    "page=1.5",
    "page=1e2",
    "page=1000000",
    "q=one&q=two",
  ])("rejects invalid page filters: %s", (query) => {
    expect(parseDonationPageFilters(new URLSearchParams(query))).toEqual({
      ok: false,
    });
  });

  it("ignores page completely for exports", () => {
    expect(
      parseDonationExportFilters(
        new URLSearchParams("status=PENDING&page=x&page=y"),
      ),
    ).toMatchObject({ ok: true, value: { status: "PENDING" } });
  });

  it("builds exact case-insensitive search conditions", () => {
    const filters = expectValid(
      parseDonationExportFilters(new URLSearchParams("q= donor ")),
    );

    expect(buildDonationWhere(filters)).toEqual({
      OR: [
        { donorName: { contains: "donor", mode: "insensitive" } },
        { donorEmail: { contains: "donor", mode: "insensitive" } },
        {
          providerPaymentId: {
            contains: "donor",
            mode: "insensitive",
          },
        },
      ],
    });
  });

  it.each([
    [
      "from=2026-08-23&to=2026-08-23",
      "2026-08-22T21:00:00.000Z",
      "2026-08-23T21:00:00.000Z",
    ],
    [
      "from=2010-03-28&to=2010-03-28",
      "2010-03-27T21:00:00.000Z",
      "2010-03-28T20:00:00.000Z",
    ],
    [
      "from=2014-10-26&to=2014-10-26",
      "2014-10-25T20:00:00.000Z",
      "2014-10-26T21:00:00.000Z",
    ],
  ])("uses Moscow calendar boundaries for %s", (query, from, to) => {
    const filters = expectValid(
      parseDonationExportFilters(new URLSearchParams(query)),
    );

    expect(buildDonationWhere(filters)).toEqual({
      createdAt: { gte: new Date(from), lt: new Date(to) },
    });
  });
});
