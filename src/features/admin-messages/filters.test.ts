import { describe, expect, it } from "vitest";

import {
  buildContactQuery,
  buildContactWhere,
  parseContactPageFilters,
  safeMessagesReturnTo,
} from "./filters";

function expectValid<T>(result: { ok: true; value: T } | { ok: false }) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid filters");
  return result.value;
}

describe("contact page filters", () => {
  it("matches the combined active count and preserves an exact stale cutoff", () => {
    const query = new URLSearchParams("status=ACTIVE&before=2026-10-17T09%3A12%3A34.000Z&page=2");
    const filters = expectValid(parseContactPageFilters(query));
    expect(buildContactWhere(filters)).toEqual({
      folder: "INBOX",
      status: { in: ["NEW", "IN_PROGRESS"] },
      createdAt: { lt: new Date("2026-10-17T09:12:34.000Z") },
    });
    expect(buildContactQuery(filters).get("before")).toBe("2026-10-17T09:12:34.000Z");
  });

  it.each(["https://evil.test", "//evil.test", "/admin/messages/one", "/admin/messages?status=BAD", "/admin/messages?returnTo=https://evil.test", "/admin/messages#foo", "/admin/messages?before=bad"])('rejects unsafe return target %s', (value) => {
    expect(safeMessagesReturnTo(value)).toBe("/admin/messages");
  });

  it("preserves valid list filters in a return target", () => {
    expect(safeMessagesReturnTo("/admin/messages?status=ACTIVE&q=hello&page=2")).toBe("/admin/messages?status=ACTIVE&q=hello&page=2");
  });
  it("uses the stricter of the exact cutoff and calendar end date", () => {
    const filters = expectValid(parseContactPageFilters(new URLSearchParams("status=NEW&before=2026-10-17T09%3A12%3A34.000Z&to=2026-10-16")));
    expect(buildContactWhere(filters)).toEqual({ folder: "INBOX", status: "NEW", createdAt: { lt: new Date("2026-10-16T21:00:00.000Z") } });
  });
  it.each(["before=bad", "before=2026-02-30T00%3A00%3A00.000Z", "before=2026-10-16T12%3A00%3A00Z", "before=2026-10-16T12%3A00%3A00.000Z&before=2026-10-16T12%3A00%3A00.000Z"])("rejects invalid exact cutoff %s", (query) => {
    expect(parseContactPageFilters(new URLSearchParams(query))).toEqual({ ok: false });
  });
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
      folder: "INBOX",
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

describe("contact folders", () => {
  it("defaults the inbox query and keeps folder filters in return links", () => {
    expect(buildContactWhere({})).toEqual({ folder: "INBOX" });
    const parsed = parseContactPageFilters(new URLSearchParams("folder=ARCHIVE&page=2"));
    expect(parsed).toEqual({ ok: true, value: { folder: "ARCHIVE", page: 2 } });
    expect(safeMessagesReturnTo("/admin/messages?folder=TRASH&page=2")).toBe("/admin/messages?folder=TRASH&page=2");
  });
  it.each(["folder=BAD", "folder=INBOX&folder=TRASH"])("rejects invalid folder input %s", (query) => {
    expect(parseContactPageFilters(new URLSearchParams(query)).ok).toBe(false);
  });
});
