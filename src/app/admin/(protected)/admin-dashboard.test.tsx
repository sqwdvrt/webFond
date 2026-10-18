import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminDashboardReadModel } from "@/features/admin-dashboard/read-model";

import { renderAdminDashboard } from "./page";

const dashboard: AdminDashboardReadModel = {
  messages: { newCount: 7, activeCount: 5 },
  content: { publishedProjectCount: 11, draftCount: 12 },
  donations: {
    today: { count: 4, amountKopecks: 125_500 },
    month: { count: 18, amountKopecks: 990_000 },
  },
  alerts: [
    {
      code: "ADMIN_CONFIGURATION",
      severity: "warning",
      message: "Обнаружена проблема конфигурации административной части.",
      href: "/api/ready",
    },
    {
      code: "STALE_PENDING_DONATIONS",
      severity: "warning",
      message: "Ожидающих пожертвований старше часа: 3.",
      href: "/admin/donations?status=PENDING",
    },
    {
      code: "STALE_NEW_CONTACTS",
      severity: "warning",
      message: "Новых обращений старше 48 часов: 2.",
      href: "/admin/messages?status=NEW",
    },
  ],
  recentActivity: [
    {
      id: "audit-private-id",
      action: "CONTENT_PUBLISHED",
      entityType: "PROJECT",
      previousStatus: "DRAFT",
      nextStatus: "PUBLISHED",
      createdAt: new Date("2026-01-31T22:00:00.000Z"),
    },
    {
      id: "audit-news-id",
      action: "CONTENT_CREATED",
      entityType: "NEWS_POST",
      previousStatus: null,
      nextStatus: "DRAFT",
      createdAt: new Date("2026-01-31T21:30:00.000Z"),
    },
    {
      id: "audit-document-id",
      action: "CONTENT_ARCHIVED",
      entityType: "DOCUMENT",
      previousStatus: "PUBLISHED",
      nextStatus: "ARCHIVED",
      createdAt: new Date("2026-01-31T21:15:00.000Z"),
    },
    {
      id: "audit-contact-id",
      action: "CONTACT_NOTE_CHANGED",
      entityType: "CONTACT_REQUEST",
      previousStatus: null,
      nextStatus: null,
      createdAt: new Date("2026-01-31T21:00:00.000Z"),
    },
    {
      id: "audit-contact-status-id",
      action: "CONTACT_STATUS_CHANGED",
      entityType: "CONTACT_REQUEST",
      previousStatus: "NEW",
      nextStatus: "IN_PROGRESS",
      createdAt: new Date("2026-01-31T20:30:00.000Z"),
    },
    {
      id: "audit-hostile-contact-status-id",
      action: "CONTACT_STATUS_CHANGED",
      entityType: "CONTACT_REQUEST",
      previousStatus: "PRIVATE-OLD",
      nextStatus: "PRIVATE-NEW",
      createdAt: new Date("2026-01-31T20:00:00.000Z"),
    },
    {
      id: "audit-incompatible-action-id",
      action: "CONTACT_NOTE_CHANGED",
      entityType: "PROJECT",
      previousStatus: "PRIVATE-INCOMPATIBLE",
      nextStatus: null,
      createdAt: new Date("2026-01-31T19:30:00.000Z"),
    },
  ],
};

function dependencies(model = dashboard) {
  return {
    requireSession: vi.fn(async () => ({ username: "fixture-operator" })),
    loadDashboard: vi.fn(async () => model),
  };
}

describe("admin dashboard", () => {
  it("uses canonical contact status labels in every contact-status consumer", () => {
    const consumerPaths = [
      "src/app/admin/(protected)/messages/message-form.tsx",
      "src/app/admin/(protected)/messages/messages-view.tsx",
      "src/app/admin/(protected)/page.tsx",
    ];
    const consumers = consumerPaths.map((path) => ({
      path,
      source: readFileSync(resolve(process.cwd(), path), "utf8"),
    }));

    for (const { path, source } of consumers) {
      expect(source, path).toMatch(
        /import\s*\{[^}]*\bCONTACT_STATUS_LABELS\b[^}]*\}\s*from ["']@\/features\/admin-messages\/presentation["']/,
      );
      expect(source, path).not.toMatch(/NEW:\s*["']Новое["']/);
      expect(source, path).not.toMatch(/IN_PROGRESS:\s*["']В работе["']/);
      expect(source, path).not.toMatch(/CLOSED:\s*["']Закрыто["']/);
      expect(source, path).not.toMatch(/SPAM:\s*["']Спам["']/);
    }

    const dashboardSource = consumers.find(
      ({ path }) => path === "src/app/admin/(protected)/page.tsx",
    )?.source;
    expect(dashboardSource).toMatch(
      /event\.action === ["']CONTACT_STATUS_CHANGED["'][\s\S]*?CONTACT_STATUS_LABELS\[/,
    );
  });

  it("authenticates before loading and does not query after denial", async () => {
    const denied = new Error("guest denied");
    const deps = dependencies();
    deps.requireSession.mockRejectedValue(denied);

    await expect(renderAdminDashboard(deps)).rejects.toBe(denied);
    expect(deps.requireSession).toHaveBeenCalledOnce();
    expect(deps.loadDashboard).not.toHaveBeenCalled();
  });

  it("links prioritized operational alerts in model order", async () => {
    render(await renderAdminDashboard(dependencies()));

    const alerts = screen.getByRole("list", { name: "Требует внимания" });
    const alertLinks = within(alerts).getAllByRole("link");

    expect(alertLinks.map((link) => link.textContent)).toEqual([
      "Обнаружена проблема конфигурации административной части.",
      "Ожидающих пожертвований старше часа: 3.",
      "Новых обращений старше 48 часов: 2.",
    ]);
    expect(alertLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/api/ready",
      "/admin/donations?status=PENDING",
      "/admin/messages?status=NEW",
    ]);
  });

  it("disables route prefetching for operational alert links", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/page.tsx"),
      "utf8",
    );

    expect(source).toMatch(
      /<Link\s+href=\{alert\.href\}\s+prefetch=\{false\}>/,
    );
  });

  it("renders safe entity labels and descriptions without audit details", async () => {
    const { container } = render(await renderAdminDashboard(dependencies()));

    expect(screen.getAllByText("Проект")).toHaveLength(2);
    expect(screen.getByText("Проект опубликован")).toBeVisible();
    expect(screen.getByText("Новость")).toBeVisible();
    expect(screen.getByText("Новость создана")).toBeVisible();
    expect(screen.getByText("Документ")).toBeVisible();
    expect(screen.getByText("Документ архивирован")).toBeVisible();
    expect(screen.getAllByText("Обращение")).toHaveLength(3);
    expect(screen.getAllByText("Изменена внутренняя заметка обращения")).toHaveLength(1);
    expect(
      screen.getByText("Статус обращения изменён: Новое → В работе"),
    ).toBeVisible();
    expect(screen.getByText("Статус обращения изменён")).toBeVisible();
    expect(screen.getByText("Выполнено административное действие")).toBeVisible();
    expect(screen.getByText("01.02.2026, 01:00")).toBeVisible();

    for (const event of dashboard.recentActivity) {
      expect(container).not.toHaveTextContent(event.id);
    }
    expect(container).not.toHaveTextContent("PRIVATE-OLD");
    expect(container).not.toHaveTextContent("PRIVATE-NEW");
    expect(container).not.toHaveTextContent("PRIVATE-INCOMPATIBLE");
  });

  it("loads once and renders six operational metric groups accessibly", async () => {
    const deps = dependencies();
    const { container } = render(await renderAdminDashboard(deps));

    expect(deps.requireSession).toHaveBeenCalledOnce();
    expect(deps.loadDashboard).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Обзор" })).toBeVisible();

    const metricExpectations: Array<[string, ...(string | RegExp)[]]> = [
      ["Новые обращения", "7"],
      ["Активные обращения", "5"],
      ["Успешные пожертвования сегодня", "4 успешных", /1\s255,00 RUB/],
      ["Успешные пожертвования за месяц", "18 успешных", /9\s900,00 RUB/],
      ["Опубликованные проекты", "11"],
      ["Черновики", "12"],
    ];

    expect(
      Array.from(container.querySelectorAll("dt"), (term) => term.textContent),
    ).toEqual(metricExpectations.map(([label]) => label));

    for (const [label, ...values] of metricExpectations) {
      const term = screen.getByText(label, { selector: "dt" });
      const metric = term.closest("div");

      expect(metric).not.toBeNull();
      for (const value of values) {
        expect(within(metric!).getByText(value)).toBeVisible();
      }
    }

    const navigation = screen.getByRole("navigation", {
      name: "Управление разделами",
    });
    expect(within(navigation).getAllByRole("link")).toHaveLength(6);
    expect(within(navigation).getByRole("link", { name: /Письма/ })).toHaveAttribute(
      "href",
      "/admin/messages",
    );
    expect(within(navigation).getByRole("link", { name: /Проекты/ })).toHaveAttribute(
      "href",
      "/admin/projects",
    );
    expect(within(navigation).getByRole("link", { name: /Новости/ })).toHaveAttribute(
      "href",
      "/admin/news",
    );
    expect(within(navigation).getByRole("link", { name: /Документы/ })).toHaveAttribute(
      "href",
      "/admin/documents",
    );
    expect(within(navigation).getByRole("link", { name: /Реквизиты/ })).toHaveAttribute(
      "href",
      "/admin/requisites",
    );
    expect(within(navigation).getByRole("link", { name: /Пожертвования/ })).toHaveAttribute(
      "href",
      "/admin/donations",
    );
    for (const icon of navigation.querySelectorAll("svg")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("renders calm empty states accessibly", async () => {
    const empty: AdminDashboardReadModel = {
      messages: { newCount: 0, activeCount: 0 },
      content: { publishedProjectCount: 0, draftCount: 0 },
      donations: {
        today: { count: 0, amountKopecks: 0 },
        month: { count: 0, amountKopecks: 0 },
      },
      alerts: [],
      recentActivity: [],
    };

    const { container } = render(
      await renderAdminDashboard(dependencies(empty)),
    );

    expect(screen.getByText("Требующих внимания предупреждений нет.")).toBeVisible();
    expect(screen.getByText("Действий пока нет.")).toBeVisible();
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
