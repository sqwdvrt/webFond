import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CookiesPage from "@/app/cookies/page";
import ConsentPage from "@/app/personal-data-consent/page";
import PrivacyPage from "@/app/privacy/page";
import {
  cookiesPublication,
  personalDataConsentPublication,
  privacyPolicyPublication,
} from "@/content/legal";

describe("published legal pages", () => {
  it("publishes privacy and consent versions aligned with donation receipts", () => {
    expect(privacyPolicyPublication.version).toBe("2026-09-04");
    expect(personalDataConsentPublication.version).toBe("2026-09-04");

    const donorData = privacyPolicyPublication.sections
      .find((section) => section.heading === "5. Состав обрабатываемых персональных данных")
      ?.paragraphs.find((paragraph) => paragraph.startsWith("5.3."));
    expect(donorData).toMatch(/адрес электронной почты/);
    expect(donorData).toMatch(/кассового чека/);
    expect(donorData).toMatch(/ЮKassa/);
    expect(donorData).not.toMatch(/не запрашиваются/);

    const consentData = personalDataConsentPublication.sections
      .find((section) => section.heading === "2. Перечень персональных данных")
      ?.paragraphs.join("\n");
    expect(consentData).toMatch(/форме пожертвования/);
    expect(consentData).toMatch(/кассового чека/);
  });

  it("renders the approved privacy policy", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", {
        name: privacyPolicyPublication.title,
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getAllByText(/Таймвэб\.Облако/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Neon, LLC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vercel Inc/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Скачать документ Word" }),
    ).toHaveAttribute("href", "/documents/politika-personalnyh-dannyh.docx");
    expect(
      screen.queryByText("Текст требует утверждения юристом"),
    ).not.toBeInTheDocument();
  });

  it("renders the approved personal data consent", () => {
    render(<ConsentPage />);
    expect(
      screen.getByRole("heading", {
        name: personalDataConsentPublication.title,
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getByText(/ЮKassa/)).toBeVisible();
    expect(screen.getByText(/Таймвэб\.Облако/)).toBeVisible();
    expect(screen.queryByText(/Vercel Inc/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Скачать документ Word" }),
    ).toHaveAttribute("href", "/documents/soglasie-na-obrabotku-dannyh.docx");
  });

  it("renders the cookie notice aligned with the privacy policy", () => {
    render(<CookiesPage />);
    expect(
      screen.getByRole("heading", { name: cookiesPublication.title, level: 1 }),
    ).toBeVisible();
    expect(screen.getByText(/Рекламные и аналитические счетчики/)).toBeVisible();
  });
});
