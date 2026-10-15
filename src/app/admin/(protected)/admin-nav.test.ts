import { createElement, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

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

  it("scrolls the current section link into view", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(usePathname).mockReturnValue("/admin/donations");

    render(createElement(AdminNav as () => ReactElement));

    expect(screen.getByRole("link", { name: "Пожертвования" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "center",
    });
  });
});
