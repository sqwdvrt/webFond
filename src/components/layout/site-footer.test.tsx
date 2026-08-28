import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";

describe("SiteFooter", () => {
  it("keeps the brand, contact, and copyright without registration numbers", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Фонд «Быть Добру»" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "sorovoi@mail.ru" })).toHaveAttribute(
      "href",
      "mailto:sorovoi@mail.ru",
    );
    expect(screen.getByText(`© ${new Date().getFullYear()} Фонд «Быть Добру»`)).toBeVisible();
    expect(screen.queryByText(/ОГРН/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ИНН/)).not.toBeInTheDocument();
    expect(screen.queryByText(/КПП/)).not.toBeInTheDocument();
  });

  it("links to the required legal pages", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Оферта пожертвования" })).toHaveAttribute(
      "href",
      "/donation-offer",
    );
    expect(screen.getByRole("link", { name: "Реквизиты" })).toHaveAttribute("href", "/requisites");
    expect(screen.getByRole("link", { name: "Файлы cookie" })).toHaveAttribute("href", "/cookies");
  });
});
