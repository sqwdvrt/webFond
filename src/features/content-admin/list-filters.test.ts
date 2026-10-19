import { describe, expect, it } from "vitest";

import {
  buildContentListUrl,
  parseContentListFilters,
  safeContentReturnTo,
  contentEditorHref,
} from "./list-filters";

describe("content list URL filters", () => {
  it("defaults and trims Cyrillic search", () => {
    expect(parseContentListFilters({})).toEqual({ q: "", status: "", page: 1, sort: "updated-desc" });
    expect(parseContentListFilters({ q: "  Помощь семьям  ", status: "DRAFT", page: "2", sort: "updated-asc" }))
      .toEqual({ q: "Помощь семьям", status: "DRAFT", page: 2, sort: "updated-asc" });
  });

  it.each(["0", "-1", "1.5", "1e2", "Infinity", "99999999999999999", "1000000"])("normalizes invalid page %s", (page) => {
    expect(parseContentListFilters({ page }).page).toBe(1);
  });

  it("ignores duplicate, unknown, and overlong values independently", () => {
    expect(parseContentListFilters({ q: "x".repeat(121), status: "DELETED", sort: "title", page: ["1", "2"] }))
      .toEqual(parseContentListFilters({}));
    expect(parseContentListFilters(new URLSearchParams("q=a&q=b&status=PUBLISHED")).q).toBe("");
  });

  it("round trips only validated list parameters", () => {
    const filters = parseContentListFilters({ q: "Помощь", status: "PUBLISHED", page: "3", sort: "updated-asc", success: "deleted" });
    const url = buildContentListUrl("/admin/projects", filters);
    expect(parseContentListFilters(new URL(url, "https://example.org").searchParams)).toEqual(filters);
    expect(url).not.toContain("success");
    expect(safeContentReturnTo(url, "/admin/projects")).toBe(url);
  });

  it("encodes editor IDs and attaches only canonical list state", () => {
    const filters = parseContentListFilters({ q: "Помощь", page: "2", success: "deleted" });
    const href = contentEditorHref("/admin/news", "a/b", filters);
    expect(href.split("?")[0]).toBe("/admin/news/a%2Fb");
    expect(new URL(href, "https://example.org").searchParams.get("returnTo"))
      .toBe(buildContentListUrl("/admin/news", filters));
    expect(contentEditorHref("/admin/news", "new", parseContentListFilters({}))).toBe("/admin/news/new");
    expect(safeContentReturnTo(["/admin/news"], "/admin/news")).toBe("/admin/news");
  });

  it.each(["https://evil.test/admin/projects", "//evil.test/admin/projects", "/admin/news?q=x", "/admin/projects/1", "/admin/projects#fragment", "/admin/projects?status=BAD", "/admin/projects?q=a&q=b", "/admin/projects?next=https://evil.test", "/admin/../admin/projects", "/admin\\projects", "%2Fadmin%2Fprojects"])("rejects unsafe return URL %s", (url) => {
    expect(safeContentReturnTo(url, "/admin/projects")).toBe("/admin/projects");
  });
});
