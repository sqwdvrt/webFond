import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import AboutPage from "@/app/about/page";
import ContactsPage from "@/app/contacts/page";
import HelpPage, { renderHelpPage } from "@/app/help/page";
import RequisitesError from "@/app/requisites/error";
import { renderRequisitesPage } from "@/app/requisites/page";
import { siteConfig } from "@/config/site";
import type { RequisitesInput } from "@/features/content-admin/types";

const publishedRequisites: RequisitesInput = {
  version: 1,
  status: "PUBLISHED",
  fullName: "Благотворительный фонд «Проверенные реквизиты»",
  shortName: "БФ «ПР»",
  ogrn: "1234567890123",
  inn: "1234567890",
  kpp: "123456789",
  address: "г. Москва, ул. Проверенная, д. 1",
  email: "verified@example.org",
  bankName: "Проверенный банк",
  recipientName: "БФ «ПР»",
  checkingAccount: "40703810000000000001",
  correspondentAccount: "30101810000000000001",
  bik: "044525001",
};

function requisitesDependencies(
  result: { status: "published" | "fallback"; value: RequisitesInput } | Error,
) {
  return {
    getRequisites: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

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

  it("renders the live donation form when payments are enabled", () => {
    render(renderHelpPage({ paymentsEnabled: () => true }));
    expect(screen.getByRole("button", { name: "Оплатить через СБП" })).toBeEnabled();
    expect(screen.queryByText("СБП подключается.")).not.toBeInTheDocument();
  });

  it("fails closed to the preview when availability throws", () => {
    render(
      renderHelpPage({
        paymentsEnabled: () => {
          throw new Error("config");
        },
      }),
    );
    expect(screen.getByRole("group")).toBeDisabled();
  });

  it("shows confirmed contacts and no application form", () => {
    render(<ContactsPage />);
    expect(screen.getByRole("link", { name: "SOROVOI@MAIL.RU" })).toHaveAttribute("href", "mailto:SOROVOI@MAIL.RU");
    expect(screen.getByText(/Сайт не принимает и не обрабатывает заявки на помощь/)).toBeVisible();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("shows validated published legal and bank details with an email link", async () => {
    render(await renderRequisitesPage(requisitesDependencies({
      status: "published",
      value: publishedRequisites,
    })));

    expect(screen.getByText(publishedRequisites.ogrn)).toBeVisible();
    expect(screen.getByText(publishedRequisites.bankName)).toBeVisible();
    expect(screen.getByText(publishedRequisites.bik)).toBeVisible();
    expect(screen.getByRole("link", { name: publishedRequisites.email })).toHaveAttribute(
      "href",
      `mailto:${publishedRequisites.email}`,
    );
    expect(screen.queryByText(/Банковские реквизиты готовятся/)).not.toBeInTheDocument();
  });

  it.each(["draft", "archived", "malformed"])(
    "keeps confirmed legal rows and hides %s bank values",
    async () => {
      render(await renderRequisitesPage(requisitesDependencies({
        status: "fallback",
        value: { ...publishedRequisites, status: "DRAFT" },
      })));

      expect(screen.getByText(siteConfig.name)).toBeVisible();
      expect(screen.getByText(siteConfig.shortName)).toBeVisible();
      expect(screen.getByText(siteConfig.legal.ogrn)).toBeVisible();
      expect(screen.getByText(siteConfig.legal.inn)).toBeVisible();
      expect(screen.getByText(siteConfig.legal.kpp)).toBeVisible();
      expect(screen.getByText(siteConfig.legal.address)).toBeVisible();
      expect(screen.getByRole("link", { name: siteConfig.legal.email })).toHaveAttribute(
        "href",
        `mailto:${siteConfig.legal.email}`,
      );
      expect(screen.getByText(/Банковские реквизиты готовятся/)).toBeVisible();
      expect(screen.queryByText(publishedRequisites.fullName)).not.toBeInTheDocument();
      expect(screen.queryByText(publishedRequisites.bankName)).not.toBeInTheDocument();
      expect(screen.queryByText(/БИК/)).toBeNull();
    },
  );

  it("preserves confirmed legal rows and hides bank values when the read fails", async () => {
    render(await renderRequisitesPage(
      requisitesDependencies(new Error("private database detail")),
    ));

    expect(screen.getByText(siteConfig.legal.ogrn)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Банковские реквизиты временно недоступны. Попробуйте обновить страницу позже.",
    );
    expect(screen.queryByText(publishedRequisites.bankName)).not.toBeInTheDocument();
    expect(screen.queryByText(/БИК/)).toBeNull();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });

  it("forces dynamic rendering so a caught database failure is not route-cached", () => {
    const source = readFileSync(join(process.cwd(), "src/app/requisites/page.tsx"), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("requisites error boundary", () => {
  it("is a typed client component with neutral copy and retry", () => {
    const reset = vi.fn();
    render(<RequisitesError error={new Error("private database detail")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Не удалось загрузить реквизиты" })).toBeVisible();
    expect(screen.getByText("Попробуйте загрузить страницу еще раз.")).toBeVisible();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();

    const source = readFileSync(join(process.cwd(), "src/app/requisites/error.tsx"), "utf8");
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/error:\s*Error\s*&\s*\{\s*digest\?:\s*string\s*\}/);
    expect(source).toMatch(/reset:\s*\(\)\s*=>\s*void/);
  });
});
