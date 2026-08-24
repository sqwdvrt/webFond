import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/admin-auth/session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

import { AdminShell } from "./admin-shell";
import ProtectedAdminLayout from "./layout";

describe("AdminShell", () => {
  it("defines the shared workspace, content controls and narrow viewport scrolling", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/admin/admin.module.css"),
      "utf8",
    );

    for (const className of [
      "workspace",
      "workspaceHeader",
      "adminNavViewport",
      "overviewNavigation",
      "contentTableViewport",
      "publicationStatus",
      "iconButton",
      "dangerButton",
      "adminError",
    ]) {
      expect(css).toContain(`.${className}`);
    }

    expect(css).toMatch(
      /\.adminNavViewport,\s*\.contentTableViewport\s*\{[^}]*overflow-x:\s*auto/,
    );
    expect(css).not.toMatch(
      /\.workspaceBrand span,\s*\.currentAccount\s*\{[^}]*display:\s*none/,
    );
    expect(css).toContain(".submitButtonLabel");
  });

  it("shows one account header and all protected sections", async () => {
    const { container } = render(
      <AdminShell username="fixture-operator">
        <h1>Содержимое раздела</h1>
      </AdminShell>,
    );

    expect(screen.getByText("fixture-operator")).toBeVisible();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeEnabled();

    const links = [
      ["Обзор", "/admin"],
      ["Проекты", "/admin/projects"],
      ["Новости", "/admin/news"],
      ["Документы", "/admin/documents"],
      ["Реквизиты", "/admin/requisites"],
      ["Пожертвования", "/admin/donations"],
    ] as const;

    for (const [name, href] of links) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }

    expect(screen.getByRole("heading", { name: "Содержимое раздела" })).toBeVisible();

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

describe("ProtectedAdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      username: "fixture-operator",
    });
  });

  it("authenticates before rendering the shared shell", async () => {
    const denied = new Error("guest denied");
    mocks.requireAdminSession.mockRejectedValue(denied);

    await expect(
      ProtectedAdminLayout({ children: <p>Закрытые данные</p> }),
    ).rejects.toBe(denied);
    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(screen.queryByText("Закрытые данные")).not.toBeInTheDocument();
  });

  it("passes the authenticated account to the shared shell", async () => {
    render(
      await ProtectedAdminLayout({ children: <p>Закрытые данные</p> }),
    );

    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(screen.getByText("fixture-operator")).toBeVisible();
    expect(screen.getByText("Закрытые данные")).toBeVisible();
  });
});
