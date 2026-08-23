import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DonationPageResult } from "@/features/admin-donations/repository";
import type { DonationPageFilters } from "@/features/admin-donations/types";

import { DonationsView } from "./donations-view";
import { renderDonationsPage } from "./page";

const filters: DonationPageFilters = {
  status: "SUCCEEDED",
  from: "2026-08-01",
  to: "2026-08-23",
  q: "fixture",
  page: 1,
};

const result: DonationPageResult = {
  rows: [
    {
      id: "donation-1",
      providerPaymentId: null,
      amountKopecks: 12500,
      currency: "RUB",
      status: "SUCCEEDED",
      donorName: null,
      donorEmail: null,
      paidAt: null,
      createdAt: new Date("2026-08-23T09:00:00.000Z"),
    },
  ],
  total: 51,
  totalPages: 2,
  page: 1,
  pageSize: 50,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireSession: vi.fn(async () => ({ username: "fixture-operator" })),
    parseFilters: vi.fn(() => ({ ok: true as const, value: filters })),
    getPage: vi.fn(async () => result),
    navigate: vi.fn((path: string): never => {
      throw new Error(`redirect:${path}`);
    }),
    ...overrides,
  };
}

describe("donations page orchestration", () => {
  it("checks the session before parsing filters or querying", async () => {
    const denied = new Error("guest denied");
    const deps = dependencies({
      requireSession: vi.fn(async () => {
        throw denied;
      }),
    });

    await expect(renderDonationsPage({}, deps)).rejects.toBe(denied);
    expect(deps.parseFilters).not.toHaveBeenCalled();
    expect(deps.getPage).not.toHaveBeenCalled();
  });

  it("renders a neutral invalid-filter state without querying", async () => {
    const deps = dependencies({
      parseFilters: vi.fn(() => ({ ok: false as const })),
    });

    render(await renderDonationsPage({}, deps));
    expect(screen.getByRole("heading", { name: "Некорректные фильтры" })).toBeVisible();
    expect(deps.getPage).not.toHaveBeenCalled();
  });

  it("redirects an excessive page to the exact canonical URL", async () => {
    const requested = { ...filters, page: 999999 };
    const deps = dependencies({
      parseFilters: vi.fn(() => ({ ok: true as const, value: requested })),
      getPage: vi.fn(async () => ({ ...result, page: 2 })),
    });

    await expect(renderDonationsPage({}, deps)).rejects.toThrow(
      "redirect:/admin/donations?status=SUCCEEDED&from=2026-08-01&to=2026-08-23&q=fixture&page=2",
    );
  });
});

describe("DonationsView", () => {
  it("renders filters, operational columns, null placeholders and stable links", () => {
    render(<DonationsView filters={filters} result={result} />);

    expect(screen.getByRole("heading", { name: "Пожертвования" })).toBeVisible();
    expect(screen.getByLabelText("Статус")).toHaveValue("SUCCEEDED");
    expect(screen.getByLabelText("Дата от")).toHaveValue("2026-08-01");
    expect(screen.getByLabelText("Дата до")).toHaveValue("2026-08-23");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("fixture");
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getByText("125,00 RUB")).toBeVisible();
    expect(within(screen.getByRole("table")).getByText("Успешно")).toBeVisible();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Скачать CSV/ })).toHaveAttribute(
      "href",
      "/admin/donations/export?status=SUCCEEDED&from=2026-08-01&to=2026-08-23&q=fixture",
    );
    expect(screen.getByRole("link", { name: /Далее/ })).toHaveAttribute(
      "href",
      "/admin/donations?status=SUCCEEDED&from=2026-08-01&to=2026-08-23&q=fixture&page=2",
    );

    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/donations/donations-view.tsx"),
      "utf8",
    );
    expect(source).toContain("prefetch={false}");
  });

  it("renders an accessible empty state without out-of-range pagination", async () => {
    const empty = { ...result, rows: [], total: 0, totalPages: 1 };
    const { container } = render(<DonationsView filters={{ page: 1 }} result={empty} />);

    expect(screen.getByText("Пожертвования не найдены")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Назад/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Далее/ })).not.toBeInTheDocument();

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
