import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  generateNewsMetadata,
  renderNewsPage,
} from "@/app/news/page";
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
  it("forces dynamic rendering so a caught database failure is not route-cached", () => {
    const source = readFileSync(join(process.cwd(), "src/app/news/page.tsx"), "utf8");

    expect(source).toContain('export const dynamic = "force-dynamic"');
  });

  it("renders published news cards", async () => {
    const deps = newsDependencies([publishedNews]);
    render(await renderNewsPage(deps));

    expect(screen.getByRole("link", { name: publishedNews.title })).toHaveAttribute(
      "href",
      `/news/${publishedNews.slug}`,
    );
    expect(screen.getByText(publishedNews.summary!)).toBeVisible();
    expect(screen.queryByText("Раздел будет дополнен")).not.toBeInTheDocument();
    expect(deps.listNews).toHaveBeenCalledOnce();
  });

  it("shows the honest empty state for an empty published list", async () => {
    render(await renderNewsPage(newsDependencies([])));

    expect(screen.getByText("Раздел будет дополнен")).toBeVisible();
    expect(screen.getByText(/В этом разделе публикуются новости фонда/)).toBeVisible();
    expect(screen.getByRole("link", { name: "О фонде" })).toHaveAttribute("href", "/about");
  });

  it("distinguishes a temporary read failure from an empty list", async () => {
    render(await renderNewsPage(newsDependencies(new Error("database unavailable"))));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Новости сейчас не открываются. Попробуйте позже.",
    );
    expect(screen.queryByText("Раздел будет дополнен")).not.toBeInTheDocument();
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
