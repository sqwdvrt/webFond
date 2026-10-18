import { describe, expect, it } from "vitest";

import {
  buildContactQuery,
  buildContactWhere,
  parseContactPageFilters,
} from "./filters";

function expectValid<T>(result: { ok: true; value: T } | { ok: false }) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid filters");
  return result.value;
}

describe("contact page filters", () => {
  it("defaults absent optional filters to the first page", () => {
    expect(parseContactPageFilters(new URLSearchParams())).toEqual({
      ok: true,
      value: { page: 1 },
    });
  });

  it("treats blank filter values as absent", () => {
    expect(
      parseContactPageFilters(
        new URLSearchParams("status=&from=+&to=&q=++&page="),
      ),
    ).toEqual({ ok: true, value: { page: 1 } });
  });

  it.each(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"])(
    "accepts the %s status",
    (status) => {
      expect(
        expectValid(parseContactPageFilters(new URLSearchParams({ status }))),
      ).toMatchObject({ status });
    },
  );

  it.each(["status", "from", "to", "q", "page"])(
    "rejects duplicate %s values",
    (name) => {
      const query = new URLSearchParams();
      query.append(name, "1");
      query.append(name, "2");
      expect(parseContactPageFilters(query)).toEqual({ ok: false });
    },
  );

  it.each([
    "status=PENDING",
    "from=2026-02-30",
    "from=2023-02-29",
    "to=23.08.2026",
    "from=2026-08-24&to=2026-08-23",
  ])("rejects invalid status or date filters: %s", (query) => {
    expect(parseContactPageFilters(new URLSearchParams(query))).toEqual({
      ok: false,
    });
  });

  it("accepts a 120-character query and rejects 121 characters", () => {
    expect(
      parseContactPageFilters(
        new URLSearchParams({ q: "x".repeat(120) }),
      ).ok,
    ).toBe(true);
    expect(
      parseContactPageFilters(
        new URLSearchParams({ q: "x".repeat(121) }),
      ),
    ).toEqual({ ok: false });
  });

  it.each(["1", "999999"])("accepts page %s", (page) => {
    expect(
      expectValid(parseContactPageFilters(new URLSearchParams({ page }))),
    ).toMatchObject({ page: Number(page) });
  });

  it.each(["0", "01", "1.5", "1e2", "1000000"])(
    "rejects page %s",
    (page) => {
      expect(parseContactPageFilters(new URLSearchParams({ page }))).toEqual({
        ok: false,
      });
    },
  );

  it("normalizes and reconstructs a complete query", () => {
    const filters = expectValid(
      parseContactPageFilters(
        new URLSearchParams(
          "status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%20Ivan%40mail.ru%20&page=2",
        ),
      ),
    );

    expect(filters).toMatchObject({
      status: "IN_PROGRESS",
      from: "2026-08-01",
      to: "2026-08-23",
      q: "Ivan@mail.ru",
      page: 2,
    });
    expect(buildContactQuery(filters).toString()).toBe(
      "status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=Ivan%40mail.ru&page=2",
    );
  });

  it("omits the default page when reconstructing a query", () => {
    const filters = expectValid(
      parseContactPageFilters(new URLSearchParams("status=NEW&page=1")),
    );
    expect(buildContactQuery(filters).toString()).toBe("status=NEW");
  });

  it("builds case-insensitive search and half-open date conditions", () => {
    const filters = expectValid(
      parseContactPageFilters(
        new URLSearchParams(
          "status=SPAM&from=2026-08-23&to=2026-08-23&q=%20help%20",
        ),
      ),
    );

    expect(buildContactWhere(filters)).toEqual({
      status: "SPAM",
      createdAt: {
        gte: new Date("2026-08-22T21:00:00.000Z"),
        lt: new Date("2026-08-23T21:00:00.000Z"),
      },
      OR: [
        { name: { contains: "help", mode: "insensitive" } },
        { email: { contains: "help", mode: "insensitive" } },
        { message: { contains: "help", mode: "insensitive" } },
      ],
    });
  });
});
