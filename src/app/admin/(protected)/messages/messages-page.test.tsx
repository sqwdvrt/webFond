import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContactPageResult } from "@/features/admin-messages/repository";
import type { ContactMutationState } from "@/features/admin-messages/mutation";
import {
  contactEmailHref,
  contactExcerpt,
  contactReplyHref,
} from "@/features/admin-messages/presentation";
import type { ContactPageFilters } from "@/features/admin-messages/types";

import { renderMessageDetailPage } from "./[id]/page";
import { MessagesView } from "./messages-view";
import { renderMessagesPage } from "./page";

const filters: ContactPageFilters = {
  status: "IN_PROGRESS",
  from: "2026-08-01",
  to: "2026-08-23",
  q: "Анна",
  page: 2,
};

const contact = {
  id: "contact-1",
  name: "Анна Иванова",
  email: "anna@example.org",
  message: "Хочу узнать, как помочь фонду.",
  status: "IN_PROGRESS" as const,
  internalNote: "Позвонить после 18:00",
  createdAt: new Date("2026-08-23T08:00:00.000Z"),
  updatedAt: new Date("2026-08-23T09:00:00.000Z"),
};

const pageResult: ContactPageResult = {
  rows: [contact],
  total: 51,
  totalPages: 3,
  page: 2,
  pageSize: 25,
};

function listDependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    parseFilters: vi.fn(() => {
      events.push("parse");
      return { ok: true as const, value: filters };
    }),
    getPage: vi.fn(async () => {
      events.push("load");
      return pageResult;
    }),
    navigate: vi.fn((path: string): never => {
      throw new Error(`redirect:${path}`);
    }),
    ...overrides,
  };
}

function detailDependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    getContact: vi.fn(async () => {
      events.push("load");
      return contact;
    }),
    updateAction: vi.fn(async (
      ...args: [string, ContactMutationState, FormData]
    ) => {
      void args;
      return { status: "idle" as const, message: "" };
    }),
    showNotFound: vi.fn((): never => {
      throw new Error("not-found");
    }),
    ...overrides,
  };
}

describe("messages page orchestration", () => {
  it("authenticates before parsing filters or loading contacts", async () => {
    const denied = new Error("guest denied");
    const deps = listDependencies({
      requireSession: vi.fn(async () => {
        deps.events.push("session");
        throw denied;
      }),
    });

    await expect(renderMessagesPage({}, deps)).rejects.toBe(denied);

    expect(deps.events).toEqual(["session"]);
    expect(deps.parseFilters).not.toHaveBeenCalled();
    expect(deps.getPage).not.toHaveBeenCalled();
  });

  it("renders an accessible safe invalid-filter view without loading contacts", async () => {
    const deps = listDependencies({
      parseFilters: vi.fn(() => ({ ok: false as const })),
    });

    const { container } = render(
      await renderMessagesPage({ status: "PENDING" }, deps),
    );

    expect(screen.getByRole("heading", { name: "Некорректные фильтры" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Сбросить фильтры" })).toHaveAttribute(
      "href",
      "/admin/messages",
    );
    expect(deps.getPage).not.toHaveBeenCalled();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("redirects a clamped page to the canonical URL", async () => {
    const requested = { ...filters, page: 999999 };
    const deps = listDependencies({
      parseFilters: vi.fn(() => ({ ok: true as const, value: requested })),
      getPage: vi.fn(async () => ({ ...pageResult, page: 3 })),
    });

    await expect(renderMessagesPage({}, deps)).rejects.toThrow(
      "redirect:/admin/messages?status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%D0%90%D0%BD%D0%BD%D0%B0&page=3",
    );
  });

  it("redirects an empty result to the query-free first page", async () => {
    const deps = listDependencies({
      parseFilters: vi.fn(() => ({ ok: true as const, value: { page: 8 } })),
      getPage: vi.fn(async () => ({
        ...pageResult,
        rows: [],
        total: 0,
        totalPages: 1,
        page: 1,
      })),
    });

    await expect(renderMessagesPage({}, deps)).rejects.toThrow(
      "redirect:/admin/messages",
    );
  });
});

describe("MessagesView", () => {
  it("renders GET filters, a semantic contact table and numbered pagination", () => {
    render(<MessagesView filters={filters} result={pageResult} />);

    expect(screen.getByRole("heading", { name: "Обращения" })).toBeVisible();
    expect(screen.getByLabelText("Статус")).toHaveValue("IN_PROGRESS");
    expect(screen.getByLabelText("Дата от")).toHaveValue("2026-08-01");
    expect(screen.getByLabelText("Дата до")).toHaveValue("2026-08-23");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("Анна");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveAttribute(
      "placeholder",
      "Имя, email или текст обращения",
    );
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveAttribute("name", "q");
    expect(screen.getByLabelText("Статус")).toHaveAttribute("name", "status");
    expect(screen.getByLabelText("Дата от")).toHaveAttribute("name", "from");
    expect(screen.getByLabelText("Дата до")).toHaveAttribute("name", "to");
    expect(screen.getByRole("button", { name: "Применить" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Сбросить" })).toHaveAttribute(
      "href",
      "/admin/messages",
    );
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Все статусы",
      "Новое",
      "В работе",
      "Закрыто",
      "Спам",
    ]);
    expect(screen.getByText("Найдено: 51")).toBeVisible();
    expect(screen.getByText("По 25 на странице")).toBeVisible();
    expect(screen.getByText("Страница 2 из 3")).toBeVisible();
    const table = screen.getByRole("table", { name: "Обращения" });
    expect(table.querySelector("thead")).not.toBeNull();
    expect(table.querySelector("tbody")).not.toBeNull();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Имя", "Email", "Получено", "Статус", "Сообщение", "Действие"]);
    expect(screen.getByRole("row", { name: /Анна Иванова/ })).toBeVisible();
    expect(screen.getByText("23.08.2026, 11:00 МСК")).toBeVisible();
    expect(screen.getByRole("cell", { name: "В работе" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Открыть обращение Анна Иванова/ })).toHaveAttribute(
      "href",
      "/admin/messages/contact-1",
    );
    expect(screen.getByRole("link", { name: /Назад/ })).toHaveAttribute(
      "href",
      "/admin/messages?status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%D0%90%D0%BD%D0%BD%D0%B0",
    );
    expect(screen.getByRole("link", { name: /Далее/ })).toHaveAttribute(
      "href",
      "/admin/messages?status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%D0%90%D0%BD%D0%BD%D0%B0&page=3",
    );
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
      "href",
      "/admin/messages?status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%D0%90%D0%BD%D0%BD%D0%B0",
    );
    expect(screen.getByText("2", { selector: '[aria-current="page"]' })).toBeVisible();
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/admin/messages?status=IN_PROGRESS&from=2026-08-01&to=2026-08-23&q=%D0%90%D0%BD%D0%BD%D0%B0&page=3",
    );

    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/messages/messages-view.tsx"),
      "utf8",
    );
    expect(source).toMatch(
      /href=\{`\/admin\/messages\/\$\{contact\.id\}`\}[\s\S]*?prefetch=\{false\}/,
    );
  });

  it("normalizes and truncates the message excerpt without exposing a private note", () => {
    const message = `  ${"Сообщение ".repeat(30)}\n конец  `;
    render(
      <MessagesView
        filters={filters}
        result={{ ...pageResult, rows: [{ ...contact, message }] }}
      />,
    );

    expect(screen.getByText(contactExcerpt(message))).toBeVisible();
    expect(screen.queryByText(contact.internalNote)).not.toBeInTheDocument();
  });

  it("uses stable ellipses for long page ranges", () => {
    render(
      <MessagesView
        filters={{ page: 5 }}
        result={{ ...pageResult, page: 5, totalPages: 10 }}
      />,
    );

    expect(screen.getAllByText("…")).toHaveLength(2);
    for (const ellipsis of screen.getAllByText("…")) {
      expect(ellipsis).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByText("5", { selector: '[aria-current="page"]' })).toBeVisible();
  });

  it("encodes reserved email characters instead of creating mailto headers", () => {
    const email = "victim?subject=Injected&body=Text@example.org";
    render(
      <MessagesView
        filters={{ page: 1 }}
        result={{
          ...pageResult,
          page: 1,
          rows: [{ ...contact, email }],
          totalPages: 1,
        }}
      />,
    );

    expect(screen.getByRole("link", { name: email })).toHaveAttribute(
      "href",
      "mailto:victim%3Fsubject%3DInjected%26body%3DText@example.org",
    );
  });

  it("renders an accessible empty state with a reset and without pagination", async () => {
    const { container } = render(
      <MessagesView
        filters={{ page: 1 }}
        result={{ ...pageResult, rows: [], total: 0, totalPages: 1, page: 1 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Обращения не найдены" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Сбросить фильтры" })).toHaveAttribute(
      "href",
      "/admin/messages",
    );
    expect(screen.queryByRole("navigation", { name: "Страницы обращений" })).not.toBeInTheDocument();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("renders an accessible populated table and filter form", async () => {
    const { container } = render(<MessagesView filters={filters} result={pageResult} />);

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

describe("message detail page", () => {
  it("authenticates before awaiting params and search params or loading contact data", async () => {
    const denied = new Error("guest denied");
    const deps = detailDependencies({
      requireSession: vi.fn(async () => {
        deps.events.push("session");
        throw denied;
      }),
    });
    const params = {
      then: vi.fn(() => {
        deps.events.push("params");
        return Promise.resolve({ id: contact.id });
      }),
    } as unknown as Promise<{ id: string }>;
    const query = {
      then: vi.fn(() => {
        deps.events.push("query");
        return Promise.resolve({ success: "saved" });
      }),
    } as unknown as Promise<Record<string, string | string[] | undefined>>;

    await expect(renderMessageDetailPage(params, query, deps)).rejects.toBe(denied);

    expect(deps.events).toEqual(["session"]);
    expect(deps.getContact).not.toHaveBeenCalled();
  });

  it("loads only the authenticated contact and renders private details safely", async () => {
    const deps = detailDependencies();

    const { container } = render(
      await renderMessageDetailPage(
        Promise.resolve({ id: contact.id }),
        Promise.resolve({ success: "saved" }),
        deps,
      ),
    );

    expect(deps.events).toEqual(["session", "load"]);
    expect(deps.getContact).toHaveBeenCalledWith(contact.id);
    expect(screen.getByRole("heading", { name: "Обращение от Анна Иванова" })).toBeVisible();
    expect(screen.getByRole("link", { name: contact.email })).toHaveAttribute(
      "href",
      contactEmailHref(contact.email),
    );
    expect(screen.getByRole("link", { name: "Ответить по email" })).toHaveAttribute(
      "href",
      contactReplyHref(contact.email),
    );
    const statusTerm = screen.getByText("Статус");
    expect(statusTerm.nextElementSibling).toHaveTextContent("В работе");
    expect(screen.getByText(contact.message)).toBeVisible();
    expect(screen.getByText("23 августа 2026 г. в 11:00 МСК")).toBeVisible();
    expect(screen.getByText("23 августа 2026 г. в 12:00 МСК")).toBeVisible();
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue(contact.internalNote);
    expect(screen.getByText("Обращение сохранено")).toHaveAttribute("role", "status");
    expect(document.querySelector('input[name="id"]')).not.toBeInTheDocument();
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      contact.updatedAt.toISOString(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить обращение" }));
    await waitFor(() => expect(deps.updateAction).toHaveBeenCalledOnce());
    expect(deps.updateAction.mock.calls[0]?.[0]).toBe(contact.id);

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("uses the protected not-found boundary for a missing contact", async () => {
    const deps = detailDependencies({
      getContact: vi.fn(async () => {
        deps.events.push("load");
        return null;
      }),
    });

    await expect(
      renderMessageDetailPage(
        Promise.resolve({ id: "missing" }),
        Promise.resolve({}),
        deps,
      ),
    ).rejects.toThrow("not-found");
    expect(deps.showNotFound).toHaveBeenCalledOnce();
  });

  it("encodes reserved email characters on the protected detail page", async () => {
    const email = "victim?subject=Injected&body=Text@example.org";
    const deps = detailDependencies({
      getContact: vi.fn(async () => ({ ...contact, email })),
    });

    render(
      await renderMessageDetailPage(
        Promise.resolve({ id: contact.id }),
        Promise.resolve({}),
        deps,
      ),
    );

    expect(screen.getByRole("link", { name: email })).toHaveAttribute(
      "href",
      "mailto:victim%3Fsubject%3DInjected%26body%3DText@example.org",
    );
    expect(screen.getByRole("link", { name: "Ответить по email" })).toHaveAttribute(
      "href",
      contactReplyHref(email),
    );
  });
});
