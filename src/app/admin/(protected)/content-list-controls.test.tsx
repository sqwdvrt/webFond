import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseContentListFilters } from "@/features/content-admin/list-filters";
import { ContentListControls, ContentListPagination } from "./content-list-controls";

describe("content list navigation", () => {
  it("renders a labelled GET form that resets the page and success notice", async () => {
    const filters = parseContentListFilters({ q: "Семьям", status: "DRAFT", page: "3", sort: "updated-asc" });
    const { container } = render(<ContentListControls path="/admin/projects" filters={filters} />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/projects");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("Семьям");
    expect(screen.getByLabelText("Статус")).toHaveValue("DRAFT");
    expect(screen.getByLabelText("Сортировка")).toHaveValue("updated-asc");
    expect(form.querySelector('[name="page"]')).toBeNull();
    expect(form.querySelector('[name="success"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Сбросить фильтры" })).toHaveAttribute("href", "/admin/projects");
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("preserves filters in pagination and labels the current page", () => {
    render(<ContentListPagination path="/admin/news" filters={parseContentListFilters({ q: "Добро", status: "PUBLISHED", sort: "updated-asc" })} page={2} total={51} totalPages={3} />);
    expect(screen.getByRole("navigation", { name: "Страницы списка" })).toBeVisible();
    expect(screen.getByText("Страница 2 из 3")).toHaveAttribute("aria-current", "page");
    const next = screen.getByRole("link", { name: "Следующая страница" });
    const query = new URL(next.getAttribute("href")!, "https://example.org").searchParams;
    expect(Object.fromEntries(query)).toEqual({ q: "Добро", status: "PUBLISHED", page: "3", sort: "updated-asc" });
    expect(screen.getByRole("link", { name: "Предыдущая страница" })).toHaveAttribute("href", expect.not.stringContaining("page="));
  });

  it.each([[1, 2, false, true], [2, 2, true, false], [1, 1, false, false]] as const)("handles boundaries page %i of %i", (page, totalPages, previous, next) => {
    render(<ContentListPagination path="/admin/documents" filters={parseContentListFilters({})} page={page} total={26} totalPages={totalPages} />);
    expect(Boolean(screen.queryByRole("link", { name: "Предыдущая страница" }))).toBe(previous);
    expect(Boolean(screen.queryByRole("link", { name: "Следующая страница" }))).toBe(next);
  });
});
