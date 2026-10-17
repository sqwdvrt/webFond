import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countNewContactRequests: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/admin-auth/session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/features/admin-messages/repository", () => ({
  countNewContactRequests: mocks.countNewContactRequests,
}));

import { AdminShell } from "./admin-shell";
import ProtectedAdminLayout from "./layout";
import { usePathname } from "next/navigation";

describe("AdminShell", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

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
    expect(css).toContain('a[aria-current="page"]');
    expect(css).toMatch(/\.adminNavBadge\s*\{[^}]*color:\s*var\(--ink\)/);

    const stickyOffsets = [
      ...css.matchAll(/\.workspaceHeader\s*\{[^}]*top:\s*([^;]+);/g),
    ].map((match) => match[1].trim());
    expect(stickyOffsets).not.toHaveLength(0);
    expect(stickyOffsets.every((offset) => offset === "0")).toBe(
      true,
    );
    expect(css).toMatch(/\.dashboard\s*\{[^}]*padding:\s*0 0 88px/);
    expect(css).toMatch(/\.donationsPage\s*\{[^}]*padding:\s*0 0 88px/);
  });

  it("shows one account header and all protected sections", async () => {
    const { container } = render(
      <AdminShell newContactRequestCount={0} username="fixture-operator">
        <h1>Содержимое раздела</h1>
      </AdminShell>,
    );

    expect(screen.getByText("fixture-operator")).toBeVisible();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeEnabled();

    const links = [
      ["Обзор", "/admin"],
      ["Письма", "/admin/messages"],
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
    expect(screen.getByRole("link", { name: "К содержанию" })).toHaveAttribute(
      "href",
      "#admin-main",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "admin-main");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("marks the open section as the current page", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/news");
    render(
      <AdminShell newContactRequestCount={0} username="fixture-operator">
        <h1>Содержимое раздела</h1>
      </AdminShell>,
    );

    expect(screen.getByRole("link", { name: "Новости" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Обзор" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("ProtectedAdminLayout", () => {
  beforeEach(() => {
    mocks.countNewContactRequests.mockReset();
    mocks.countNewContactRequests.mockResolvedValue(0);
    mocks.requireAdminSession.mockReset();
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
    expect(mocks.countNewContactRequests).not.toHaveBeenCalled();
    expect(screen.queryByText("Закрытые данные")).not.toBeInTheDocument();
  });

  it("loads the aggregate after authentication and passes it through the shared shell", async () => {
    const calls: string[] = [];
    mocks.requireAdminSession.mockImplementation(async () => {
      calls.push("session");
      return { username: "fixture-operator" };
    });
    mocks.countNewContactRequests.mockImplementation(async () => {
      calls.push("count");
      return 3;
    });

    render(
      await ProtectedAdminLayout({ children: <p>Закрытые данные</p> }),
    );

    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(mocks.countNewContactRequests).toHaveBeenCalledOnce();
    expect(calls).toEqual(["session", "count"]);
    expect(screen.getByText("fixture-operator")).toBeVisible();
    expect(screen.getByText("Закрытые данные")).toBeVisible();
    const messagesLink = screen.getByRole("link", {
      name: "Письма 3 новых обращения",
    });
    expect(messagesLink).toHaveAttribute(
      "aria-label",
      "Письма 3 новых обращения",
    );
    expect(messagesLink.querySelector("[class*='adminNavBadge']")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("does not add a client fetch or API endpoint for the aggregate", () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/layout.tsx"),
      "utf8",
    );
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/admin-shell.tsx"),
      "utf8",
    );
    const navSource = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/admin-nav.tsx"),
      "utf8",
    );

    expect(layoutSource).toContain("countNewContactRequests");
    expect(shellSource).not.toMatch(/fetch\s*\(/);
    expect(navSource).not.toMatch(/fetch\s*\(/);
    expect(navSource).not.toContain("/api/");
  });
});
