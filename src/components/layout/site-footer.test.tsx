import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";

describe("SiteFooter", () => {
  it("renders confirmed legal and contact information", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/ОГРН 1257700318974/)).toBeVisible();
    expect(screen.getByText(/ИНН 9721254417/)).toBeVisible();
    expect(screen.getByRole("link", { name: "SOROVOI@MAIL.RU" })).toHaveAttribute(
      "href",
      "mailto:SOROVOI@MAIL.RU",
    );
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
  });
});
