import axe from "axe-core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ContactPageResult } from "@/features/admin-messages/repository";

import { MessageForm } from "./(protected)/messages/message-form";
import { MessagesView } from "./(protected)/messages/messages-view";

const formPath = resolve(
  process.cwd(),
  "src/app/admin/login/login-form.tsx",
);

describe("admin login accessibility", () => {
  it("has a named heading, fields, action, and no high-impact violations", async () => {
    expect(existsSync(formPath)).toBe(true);
    const importPath = "./login/login-form";
    const { LoginForm } = (await import(
      /* @vite-ignore */ importPath
    )) as typeof import("./login/login-form");
    const action = async () => ({ status: "idle" as const, message: "" });
    const { container } = render(<LoginForm action={action} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Вход в административную часть",
    );
    expect(screen.getByRole("textbox", { name: "Логин" })).toBeRequired();
    expect(screen.getByLabelText("Пароль")).toBeRequired();
    expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
});

describe("admin messages accessibility", () => {
  const contact = {
    id: "contact-1",
    name: "Анна Иванова",
    email: "anna@example.org",
    message: "Хочу помочь фонду.",
    status: "NEW" as const,
    createdAt: new Date("2026-08-23T08:00:00.000Z"),
    updatedAt: new Date("2026-08-23T09:00:00.000Z"),
  };

  it("has no serious or critical violations in a populated queue", async () => {
    const result: ContactPageResult = {
      rows: [contact],
      total: 1,
      totalPages: 1,
      page: 1,
      pageSize: 25,
    };
    const { container } = render(
      <MessagesView filters={{ page: 1 }} result={result} />,
    );

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("keeps populated message filters in their natural keyboard order", async () => {
    const user = userEvent.setup();
    const result: ContactPageResult = {
      rows: [contact],
      total: 51,
      totalPages: 3,
      page: 2,
      pageSize: 25,
    };
    render(<MessagesView filters={{ page: 2 }} result={result} />);

    expect(document.body).toHaveFocus();
    for (const element of document.querySelectorAll<HTMLElement>("[tabindex]")) {
      expect(element.tabIndex).toBeLessThanOrEqual(0);
    }
    await user.tab();
    expect(screen.getByRole("link", { name: "Административная часть" })).toHaveFocus();

    const filterControls = [
      screen.getByRole("link", { name: "Входящие" }),
      screen.getByRole("link", { name: "Архив" }),
      screen.getByRole("link", { name: "Корзина" }),
      screen.getByLabelText("Статус"),
      screen.getByLabelText("Дата от"),
      screen.getByLabelText("Дата до"),
      screen.getByRole("searchbox", { name: "Поиск" }),
      screen.getByRole("button", { name: "Применить" }),
      screen.getByRole("link", { name: "Сбросить" }),
    ];

    for (const control of filterControls) {
      await user.tab();
      expect(control).toHaveFocus();
    }
  });

  it("has no serious or critical violations in the private edit form", async () => {
    const action = async () => ({ status: "idle" as const, message: "" });
    const { container } = render(
      <main>
        <h1>Обращение от Анна Иванова</h1>
        <MessageForm
          action={action}
          contact={{ ...contact, internalNote: null }}
        />
      </main>,
    );

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
});
