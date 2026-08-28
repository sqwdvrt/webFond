import { describe, expect, it } from "vitest";

import { isAdminSectionCurrent } from "./admin-nav";

describe("isAdminSectionCurrent", () => {
  it("treats overview as exact and nested routes as a section match", () => {
    expect(isAdminSectionCurrent("/admin", "/admin")).toBe(true);
    expect(isAdminSectionCurrent("/admin/news", "/admin")).toBe(false);
    expect(isAdminSectionCurrent("/admin/news", "/admin/news")).toBe(true);
    expect(isAdminSectionCurrent("/admin/news/abc", "/admin/news")).toBe(true);
    expect(isAdminSectionCurrent("/admin/projects", "/admin/news")).toBe(false);
  });
});
