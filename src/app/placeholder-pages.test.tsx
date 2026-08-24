import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  generateNewsMetadata,
  renderNewsPage,
} from "@/app/news/page";
import ReportsPage, { metadata as reportsMetadata } from "@/app/reports/page";
import type { PublicEditorialListRow } from "@/features/content-admin/repository";

const publishedNews: PublicEditorialListRow = {
  id: "news-1",
  title: "Опубликованная новость",
  slug: "published-news",
  summary: "Проверенное описание новости фонда.",
  imageUrl: "https://media.example.org/news.jpg",
  publishedAt: new Date("2026-08-23T10:00:00.000Z"),
};

function newsDependencies(result: PublicEditorialListRow[] | Error) {
  return {
    listNews: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

describe("news page", () => {
  it("renders published news cards", async () => {
    const deps = newsDependencies([publishedNews]);
    render(await renderNewsPage(deps));

    expect(screen.getByRole("link", { name: publishedNews.title })).toHaveAttribute(
      "href",
      `/news/${publishedNews.slug}`,
    );
    expect(screen.getByText(publishedNews.summary!)).toBeVisible();
    expect(screen.queryByText("Материалы готовятся к публикации")).not.toBeInTheDocument();
    expect(deps.listNews).toHaveBeenCalledOnce();
  });

  it("shows the honest empty state for an empty published list", async () => {
    render(await renderNewsPage(newsDependencies([])));

    expect(screen.getByText("Материалы готовятся к публикации")).toBeVisible();
    expect(screen.getByText("Новости появятся после проверки и утверждения.")).toBeVisible();
  });

  it("distinguishes a temporary read failure from an empty list", async () => {
    render(await renderNewsPage(newsDependencies(new Error("database unavailable"))));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Новости временно недоступны. Попробуйте обновить страницу позже.",
    );
    expect(screen.queryByText("Материалы готовятся к публикации")).not.toBeInTheDocument();
    expect(screen.queryByText("database unavailable")).not.toBeInTheDocument();
  });

  it("indexes the collection only while published news exist", async () => {
    await expect(generateNewsMetadata(newsDependencies([]))).resolves.toMatchObject({
      robots: { index: false, follow: true },
    });
    await expect(
      generateNewsMetadata(newsDependencies(new Error("database unavailable"))),
    ).resolves.toMatchObject({ robots: { index: false, follow: true } });
    await expect(
      generateNewsMetadata(newsDependencies([publishedNews])),
    ).resolves.toMatchObject({
      alternates: { canonical: "/news" },
      robots: { index: true, follow: true },
    });
  });
});

describe("remaining placeholder pages", () => {
  it("shows the exact reports empty state", () => {
    render(<ReportsPage />);
    expect(screen.getByText("Проверенные отчеты появятся здесь")).toBeVisible();
  });

  it("keeps reports out of search indexes", () => {
    expect(reportsMetadata.robots).toEqual({ index: false, follow: true });
  });
});
