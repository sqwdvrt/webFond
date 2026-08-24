import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import ReportsError from "@/app/reports/error";
import { generateReportsMetadata, renderReportsPage } from "@/app/reports/page";
import type { PublicDocumentRow } from "@/features/content-admin/repository";

const publishedDocuments: PublicDocumentRow[] = [
  { id: "document-1", title: "Годовой отчет за 2025 год", category: "Отчетность", fileUrl: "/documents/annual-2025.pdf", publishedAt: new Date("2026-08-23T10:00:00.000Z") },
  { id: "document-2", title: "Устав фонда", category: "Учредительные документы", fileUrl: "https://documents.example.org/charter", publishedAt: new Date("2026-08-22T10:00:00.000Z") },
  { id: "document-3", title: "Аудиторское заключение", category: "Отчетность", fileUrl: "/documents/audit", publishedAt: new Date("2026-08-21T10:00:00.000Z") },
];

function dependencies(result: PublicDocumentRow[] | Error) {
  return { listDocuments: vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  }) };
}

describe("reports page", () => {
  it("avoids caching caught failures and shares the list read per request", () => {
    const source = readFileSync(join(process.cwd(), "src/app/reports/page.tsx"), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("createRequestCachedLoader(listPublishedDocuments)");
  });

  it("groups published document links by category with exact safe hrefs", async () => {
    const deps = dependencies(publishedDocuments);
    const { container } = render(await renderReportsPage(deps));
    const categories = Array.from(container.querySelectorAll("section[data-document-category]"));
    expect(categories).toHaveLength(2);
    const reporting = categories[0] as HTMLElement;
    expect(within(reporting).getByRole("heading", { name: "Отчетность" })).toBeVisible();
    expect(within(reporting).getByRole("link", { name: "Годовой отчет за 2025 год" })).toHaveAttribute("href", "/documents/annual-2025.pdf");
    expect(within(reporting).getByRole("link", { name: "Аудиторское заключение" })).toHaveAttribute("href", "/documents/audit");
    const charterLink = screen.getByRole("link", { name: /Устав фонда/ });
    expect(charterLink).toHaveAttribute("href", "https://documents.example.org/charter");
    expect(charterLink).toHaveAttribute("target", "_blank");
    expect(charterLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(charterLink).toHaveTextContent("Внешняя ссылка");
    expect(container).not.toHaveTextContent(/PDF|формат файла/i);
    expect(deps.listDocuments).toHaveBeenCalledOnce();
  });

  it("shows the honest empty state for an empty published list", async () => {
    render(await renderReportsPage(dependencies([])));
    expect(screen.getByText("Проверенные отчеты появятся здесь")).toBeVisible();
    expect(screen.getByText("Документы появятся после проверки и утверждения.")).toBeVisible();
  });

  it("distinguishes a temporary read failure from an empty list", async () => {
    render(await renderReportsPage(dependencies(new Error("database unavailable"))));
    expect(screen.getByRole("status")).toHaveTextContent("Отчеты временно недоступны. Попробуйте обновить страницу позже.");
    expect(screen.queryByText("Проверенные отчеты появятся здесь")).not.toBeInTheDocument();
    expect(screen.queryByText("database unavailable")).not.toBeInTheDocument();
  });

  it("indexes the collection only while published documents exist", async () => {
    await expect(generateReportsMetadata(dependencies([]))).resolves.toMatchObject({ robots: { index: false, follow: true } });
    await expect(generateReportsMetadata(dependencies(new Error("database unavailable")))).resolves.toMatchObject({ robots: { index: false, follow: true } });
    await expect(generateReportsMetadata(dependencies(publishedDocuments))).resolves.toMatchObject({ alternates: { canonical: "/reports" }, robots: { index: true, follow: true } });
  });
});

describe("reports error boundary", () => {
  it("is a typed client component with neutral copy and retry", () => {
    const reset = vi.fn();
    render(<ReportsError error={new Error("private database detail")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Не удалось загрузить отчеты" })).toBeVisible();
    expect(screen.getByText("Попробуйте загрузить страницу еще раз.")).toBeVisible();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();
    const source = readFileSync(join(process.cwd(), "src/app/reports/error.tsx"), "utf8");
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/error:\s*Error\s*&\s*\{\s*digest\?:\s*string\s*\}/);
    expect(source).toMatch(/reset:\s*\(\)\s*=>\s*void/);
  });
});
