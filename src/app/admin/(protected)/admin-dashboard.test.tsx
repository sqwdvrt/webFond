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
      code: "STALE_NEW_CONTACTS",
      severity: "warning",
      message: "Новых обращений старше 48 часов: 2.",
      href: "/admin/messages?status=NEW",
    },
    {
      code: "ADMIN_CONFIGURATION",
      severity: "warning",
      message: "Обнаружена проблема конфигурации административной части.",
      href: "/api/ready",
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
      createdAt: new Date("2026-01-31T20:00:00.000Z"),
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

  it("loads once and renders safe operational metrics and activity", async () => {
    const deps = dependencies();
    const { container } = render(await renderAdminDashboard(deps));

    expect(deps.requireSession).toHaveBeenCalledOnce();
    expect(deps.loadDashboard).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Обзор" })).toBeVisible();
    expect(screen.getByText("7", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("4 успешных")).toBeVisible();
    expect(screen.getByText(/1\s255,00 RUB/)).toBeVisible();
    expect(screen.getByText("18 успешных")).toBeVisible();
    expect(screen.getByText(/9\s900,00 RUB/)).toBeVisible();
    expect(screen.getByText("Новых обращений старше 48 часов: 2.")).toBeVisible();
    expect(screen.getByText("Проект опубликован")).toBeVisible();
    expect(screen.getByText("Изменена внутренняя заметка обращения")).toBeVisible();
    expect(
      screen.getByText("Статус обращения изменён: Новое → В работе"),
    ).toBeVisible();
    expect(screen.getByText("01.02.2026, 01:00")).toBeVisible();

    expect(container).not.toHaveTextContent("project-private-id");
    expect(container).not.toHaveTextContent("contact-private-id");
    expect(container).not.toHaveTextContent("another-private-id");
    expect(container).not.toHaveTextContent("audit-private-id");

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
