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
    render(
      createElement(AdminNav as () => ReactElement, {
        newContactRequestCount: 0,
      }),
    );

    expect(screen.getByRole("link", { name: "Обзор" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Пожертвования" })).toHaveAttribute(
      "href",
      "/admin/donations",
    );
  });

  it("omits the messages badge when there are no new requests", () => {
    render(createElement(AdminNav, { newContactRequestCount: 0 }));

    const messagesLink = screen.getByRole("link", { name: "Письма" });

    expect(messagesLink).toBeVisible();
    expect(
      messagesLink.querySelector("[class*='adminNavBadge']"),
    ).not.toBeInTheDocument();
    expect(messagesLink).not.toHaveTextContent("0");
    expect(screen.queryByLabelText(/новых обращения/)).not.toBeInTheDocument();
  });

  it("shows an accessible exact count only beside messages", () => {
    render(createElement(AdminNav, { newContactRequestCount: 3 }));

    const messagesLink = screen.getByRole("link", {
      name: "Письма 3 новых обращения",
    });
    const badge = screen.getByLabelText("3 новых обращения");

    expect(messagesLink).toContainElement(badge);
    expect(badge).toHaveTextContent("3");
    expect(screen.getAllByText("3")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Обзор" })).not.toContainElement(
      badge,
    );
  });

  it.each([
    [1, "Письма 1 новое обращение"],
    [2, "Письма 2 новых обращения"],
    [5, "Письма 5 новых обращений"],
    [21, "Письма 21 новое обращение"],
  ])("uses a Russian accessible count label for %i", (count, accessibleName) => {
    render(createElement(AdminNav, { newContactRequestCount: count }));

    expect(screen.getByRole("link", { name: accessibleName })).toBeVisible();
  });

  it("scrolls the current section link into view after pathname changes", () => {
    const scrolledElements: HTMLElement[] = [];
    const scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledElements.push(this);
    });
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(usePathname).mockReturnValue("/admin/donations");

    const { rerender } = render(
      createElement(AdminNav as () => ReactElement, {
        newContactRequestCount: 0,
      }),
    );

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
    rerender(
      createElement(AdminNav as () => ReactElement, {
        newContactRequestCount: 0,
      }),
    );

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
