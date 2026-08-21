import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AboutPage from "@/app/about/page";
import ContactsPage from "@/app/contacts/page";
import HelpPage from "@/app/help/page";
import RequisitesPage from "@/app/requisites/page";

describe("information pages", () => {
  it("uses only approved about copy", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: "О фонде" })).toBeVisible();
    expect(screen.getByText(/зарегистрирован 17 июля 2025 года в Москве/)).toBeVisible();
    expect(screen.getByText(/Гуманизм/)).toBeVisible();
  });

  it("keeps help payments disabled", () => {
    render(<HelpPage />);
    expect(screen.getByRole("group")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Онлайн-оплата скоро будет доступна" })).toBeDisabled();
  });

  it("shows confirmed contacts and no application form", () => {
    render(<ContactsPage />);
    expect(screen.getByRole("link", { name: "SOROVOI@MAIL.RU" })).toHaveAttribute("href", "mailto:SOROVOI@MAIL.RU");
    expect(screen.getByText(/Сайт не принимает и не обрабатывает заявки на помощь/)).toBeVisible();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("shows legal details but no invented bank details", () => {
    render(<RequisitesPage />);
    expect(screen.getByText("1257700318974")).toBeVisible();
    expect(screen.getByText(/Банковские реквизиты готовятся/)).toBeVisible();
    expect(screen.queryByText(/БИК/)).toBeNull();
  });
});
