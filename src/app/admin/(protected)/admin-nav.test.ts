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

  it("scrolls the current section link into view after pathname changes", () => {
    const scrolledElements: HTMLElement[] = [];
    const scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledElements.push(this);
    });
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(usePathname).mockReturnValue("/admin/donations");

    const { rerender } = render(createElement(AdminNav as () => ReactElement));

    const donationsLink = screen.getByRole("link", { name: "Пожертвования" });
    expect(donationsLink).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "center",
    });
    expect(scrolledElements).toEqual([donationsLink]);

    vi.mocked(usePathname).mockReturnValue("/admin/news");
    rerender(createElement(AdminNav as () => ReactElement));

    const newsLink = screen.getByRole("link", { name: "Новости" });
    expect(newsLink).toHaveAttribute("aria-current", "page");
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenNthCalledWith(2, {
      block: "nearest",
      inline: "center",
    });
    expect(scrolledElements).toEqual([donationsLink, newsLink]);
  });
});
