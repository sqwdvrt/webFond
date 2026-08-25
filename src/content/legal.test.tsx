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
  it("renders the approved privacy policy", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", {
        name: privacyPolicyPublication.title,
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getAllByText(/Neon, LLC/).length).toBeGreaterThan(0);
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
  });

  it("renders the cookie notice aligned with the privacy policy", () => {
    render(<CookiesPage />);
    expect(
      screen.getByRole("heading", { name: cookiesPublication.title, level: 1 }),
    ).toBeVisible();
    expect(screen.getByText(/Рекламные и аналитические счетчики/)).toBeVisible();
  });
});
