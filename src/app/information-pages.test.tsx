import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import AboutPage from "@/app/about/page";
import ContactsPage from "@/app/contacts/page";
import { renderHelpPage } from "@/app/help/page";
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
  it("uses only confirmed about copy without abstract principles", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Быть Добру" })).toBeVisible();
    expect(screen.getByText(/зарегистрирован 17 июля 2025 года в Москве/)).toBeVisible();
    expect(screen.queryByText(/Заявки на помощь через сайт не принимаем/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Цифры и отчеты не выдумываем/)).not.toBeInTheDocument();
    expect(screen.queryByText(/не заполняем заранее/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Люди" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Места и территории" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Как собираем помощь" })).toBeVisible();
    expect(screen.queryByText(/Гуманизм|Взаимопомощь|Уважение/)).not.toBeInTheDocument();
  });

  it("keeps help payments disabled", () => {
    render(renderHelpPage());
    expect(
      screen.getByRole("heading", { name: "Онлайн-пожертвования скоро будут доступны" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Оплатить онлайн" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ЮKassa" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Как устроена оплата" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Посмотреть реквизиты" })).toHaveAttribute(
      "href",
      "/requisites",
    );
    expect(screen.getByRole("heading", { name: "Перевод в приложении банка" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "Т-Банк" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "ВТБ" })).toBeVisible();
    expect(
      screen.getByText(
        "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
      ),
    ).toBeVisible();
  });

  it("renders the live donation form when payments are enabled", () => {
    render(renderHelpPage({ paymentsEnabled: () => true }));
    expect(screen.getByRole("heading", { level: 1, name: "Поддержать фонд" })).toBeVisible();
    expect(screen.getByText(/Пожертвование через ЮKassa/)).toBeVisible();
    expect(
      screen.getByText(/Выберите сумму и перейдите к оплате на стороне ЮKassa/),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Как устроена оплата" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ЮKassa" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Оплата проходит на стороне ЮKassa. Доступны Система быстрых платежей (СБП) и банковская карта. Выберите способ на странице оплаты. Если выбран СБП, подтвердите платёж в приложении банка. QR-код СБП показывает ЮKassa после перехода, не на этой странице. Email нужен для кассового чека и передаётся в ЮKassa.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/если они включены в магазине/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Оплатить онлайн" })).toBeEnabled();
    expect(
      screen.getByText(
        "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Онлайн-оплата через СБП находится в подключении.")).not.toBeInTheDocument();
    expect(screen.queryByText("Онлайн-пожертвования скоро будут доступны")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Перевод в приложении банка" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "Т-Банк" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).toBeVisible();
  });

  it("preselects a published project on the help form without a payment error", () => {
    render(
      renderHelpPage({
        paymentsEnabled: () => true,
        projects: [{ slug: "published-project", title: "Опубликованный проект" }],
        initialProjectSlug: "published-project",
      }),
    );

    expect(screen.getByLabelText("Назначение пожертвования")).toHaveValue(
      "published-project",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the statutory fund when the help project query is unknown", () => {
    render(
      renderHelpPage({
        paymentsEnabled: () => true,
        projects: [{ slug: "published-project", title: "Опубликованный проект" }],
        initialProjectSlug: "missing-project",
      }),
    );

    expect(screen.getByLabelText("Назначение пожертвования")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("fails closed to the preview when availability throws", () => {
    render(
      renderHelpPage({
        paymentsEnabled: () => {
          throw new Error("config");
        },
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Онлайн-пожертвования скоро будут доступны" }),
    ).toBeVisible();
  });

  it("shows confirmed contacts and a message form that is not a help application", () => {
    render(<ContactsPage />);
    expect(screen.getByRole("link", { name: "sorovoi@mail.ru" })).toHaveAttribute("href", "mailto:sorovoi@mail.ru");
    expect(screen.getByText(/Для обращений по деятельности фонда, поддержке и документам/)).toBeVisible();
    expect(screen.queryByText(/Заявку на получение помощи сайт не принимает/)).not.toBeInTheDocument();
    expect(screen.getByRole("form")).toBeVisible();
    expect(screen.getByRole("button", { name: "Отправить письмо" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /заявк/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Скопировать реквизиты" })).toBeVisible();
    expect(screen.queryByText(/Банковские реквизиты готовятся/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Т-Банк" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "ВТБ" })).toBeVisible();
    expect(
      screen.getByText(
        "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
      ),
    ).toBeVisible();
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
      expect(screen.getByRole("link", { name: siteConfig.legal.emailLabel })).toHaveAttribute(
        "href",
        `mailto:${siteConfig.legal.emailLabel}`,
      );
      expect(screen.getByText(/Банковские реквизиты/)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Скопировать реквизиты" })).not.toBeInTheDocument();
      expect(screen.queryByText(publishedRequisites.fullName)).not.toBeInTheDocument();
      expect(screen.queryByText(publishedRequisites.bankName)).not.toBeInTheDocument();
      expect(screen.queryByText(/БИК/)).toBeNull();
      expect(screen.queryByRole("radio", { name: "Т-Банк" })).not.toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /QR-код/ })).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
        ),
      ).not.toBeInTheDocument();
    },
  );

  it("preserves confirmed legal rows and hides bank values when the read fails", async () => {
    render(await renderRequisitesPage(
      requisitesDependencies(new Error("private database detail")),
    ));

    expect(screen.getByText(siteConfig.legal.ogrn)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Банковские данные сейчас не открываются. Попробуйте позже.",
    );
    expect(screen.queryByText(publishedRequisites.bankName)).not.toBeInTheDocument();
    expect(screen.queryByText(/БИК/)).toBeNull();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Т-Банк" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR-код/ })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
      ),
    ).not.toBeInTheDocument();
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
