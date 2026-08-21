import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NewsPage, { metadata as newsMetadata } from "@/app/news/page";
import ReportsPage, { metadata as reportsMetadata } from "@/app/reports/page";

describe("placeholder pages", () => {
  it("shows exact honest empty states", () => {
    render(<NewsPage />);
    expect(screen.getByText("Материалы готовятся к публикации")).toBeVisible();
    render(<ReportsPage />);
    expect(screen.getByText("Проверенные отчеты появятся здесь")).toBeVisible();
  });

  it("keeps placeholders out of search indexes", () => {
    expect(newsMetadata.robots).toEqual({ index: false, follow: true });
    expect(reportsMetadata.robots).toEqual({ index: false, follow: true });
  });
});
