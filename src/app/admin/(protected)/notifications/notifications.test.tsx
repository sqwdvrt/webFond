import axe from "axe-core";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), loadNotifications: vi.fn() }));
vi.mock("@/lib/admin-auth/session", () => ({ requireAdminSession: mocks.requireSession }));
vi.mock("@/features/admin-dashboard/notifications", () => ({ getAdminNotifications: mocks.loadNotifications }));

import NotificationsPage from "./page";

const alerts = [
  { code: "PAYMENTS_RECONCILIATION_STALE", message: "Проверьте планировщик.", href: "/admin/donations?status=PENDING", severity: "warning" },
  { code: "STALE_NEW_CONTACTS", message: "Новых обращений старше 48 часов: 2.", href: "/admin/messages?status=NEW", severity: "warning" },
];

describe("admin notifications", () => {
  beforeEach(() => {
    mocks.requireSession.mockReset().mockResolvedValue({ username: "admin" });
    mocks.loadNotifications.mockReset().mockResolvedValue({ alerts });
  });

  it("authenticates before loading notifications", async () => {
    const denied = new Error("denied");
    mocks.requireSession.mockRejectedValue(denied);
    await expect(NotificationsPage()).rejects.toBe(denied);
    expect(mocks.loadNotifications).not.toHaveBeenCalled();
  });

  it("shows warning links in their original priority order", async () => {
    const { container } = render(await NotificationsPage());
    expect(screen.getByRole("heading", { name: "Уведомления", level: 1 })).toBeVisible();
    const links = within(screen.getByRole("list", { name: "Требует внимания" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(alerts.map((alert) => alert.message));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(alerts.map((alert) => alert.href));
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("shows a calm empty state after warnings are resolved", async () => {
    mocks.loadNotifications.mockResolvedValue({ alerts: [] });
    render(await NotificationsPage());
    expect(screen.getByText("Новых уведомлений нет.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("retains the last reconciliation status and Moscow time", async () => {
    mocks.loadNotifications.mockResolvedValue({ alerts, reconciliation: { enabled: true, completedAt: new Date("2026-10-19T11:55:00.000Z"), failed: 2 } });
    render(await NotificationsPage());
    expect(screen.getByText(/Последняя автоматическая сверка:/)).toHaveTextContent("19.10.2026, 14:55 МСК. Ошибок в последнем запуске: 2.");
  });

  it("shows missing reconciliation data without hiding warnings", async () => {
    mocks.loadNotifications.mockResolvedValue({ alerts, reconciliation: { enabled: true, completedAt: null, failed: null } });
    render(await NotificationsPage());
    expect(screen.getByText(/Последняя автоматическая сверка:/)).toHaveTextContent("нет данных");
    expect(screen.getByRole("list", { name: "Требует внимания" })).toBeVisible();
  });
});
