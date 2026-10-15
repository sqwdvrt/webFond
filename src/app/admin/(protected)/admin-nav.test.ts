import { createElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminNav, isAdminSectionCurrent } from "./admin-nav";

describe("isAdminSectionCurrent", () => {
  it("treats overview as exact and nested routes as a section match", () => {
    expect(isAdminSectionCurrent("/admin", "/admin")).toBe(true);
    expect(isAdminSectionCurrent("/admin/news", "/admin")).toBe(false);
    expect(isAdminSectionCurrent("/admin/news", "/admin/news")).toBe(true);
    expect(isAdminSectionCurrent("/admin/news/abc", "/admin/news")).toBe(true);
    expect(isAdminSectionCurrent("/admin/projects", "/admin/news")).toBe(false);
  });
});

describe("AdminNav", () => {
  it("owns the static section definitions without receiving icon components", () => {
    render(createElement(AdminNav as () => ReactElement));

    expect(screen.getByRole("link", { name: "Обзор" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Пожертвования" })).toHaveAttribute(
      "href",
      "/admin/donations",
    );
  });
});
