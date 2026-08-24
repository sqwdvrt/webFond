import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicEditorialDetailRow } from "@/features/content-admin/repository";

const mocks = vi.hoisted(() => ({
  getPublishedNewsPostForRequest: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/features/content-admin/public-loaders", () => ({
  getPublishedNewsPostForRequest: mocks.getPublishedNewsPostForRequest,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import NewsError from "@/app/news/error";
import NewsDetailPage, { generateMetadata } from "@/app/news/[slug]/page";

const newsPost: PublicEditorialDetailRow = {
  id: "news-1",
  title: "Опубликованная новость",
  slug: "published-news",
  summary: "Проверенное описание новости фонда.",
  content: "Первый абзац новости.\n\nВторой абзац новости.",
  imageUrl: "https://media.example.org/news.jpg",
  publishedAt: new Date("2026-08-23T10:00:00.000Z"),
};

describe("published news detail", () => {
  beforeEach(() => {
    mocks.getPublishedNewsPostForRequest.mockReset();
    mocks.notFound.mockClear();
  });

  it("awaits promised params and renders only the published repository result", async () => {
    mocks.getPublishedNewsPostForRequest.mockResolvedValue(newsPost);

    render(
      await NewsDetailPage({ params: Promise.resolve({ slug: newsPost.slug }) }),
    );

    expect(mocks.getPublishedNewsPostForRequest).toHaveBeenCalledExactlyOnceWith(newsPost.slug);
    expect(screen.getByRole("heading", { level: 1, name: newsPost.title })).toBeVisible();
    expect(screen.getByText(newsPost.summary!)).toBeVisible();
    expect(screen.getByText("Первый абзац новости.")).toBeVisible();
    expect(screen.getByRole("img", { name: newsPost.title })).toHaveAttribute(
      "src",
      newsPost.imageUrl,
    );
  });

  it("keeps drafts, archives and missing slugs inaccessible through the repository filter", async () => {
    mocks.getPublishedNewsPostForRequest.mockResolvedValue(null);

    await expect(
      NewsDetailPage({ params: Promise.resolve({ slug: "draft-or-archived" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("propagates repository failures instead of translating them to notFound", async () => {
    const failure = new Error("database unavailable");
    mocks.getPublishedNewsPostForRequest.mockRejectedValue(failure);

    await expect(
      NewsDetailPage({ params: Promise.resolve({ slug: newsPost.slug }) }),
    ).rejects.toBe(failure);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("generates metadata only for a published news post", async () => {
    mocks.getPublishedNewsPostForRequest.mockResolvedValue(newsPost);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: newsPost.slug }) }),
    ).resolves.toEqual({
      title: newsPost.title,
      description: newsPost.summary,
      alternates: { canonical: `/news/${newsPost.slug}` },
    });

    mocks.getPublishedNewsPostForRequest.mockResolvedValue(null);
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "draft" }) }),
    ).resolves.toEqual({});
  });
});

describe("news error boundary", () => {
  it("is a typed client component with neutral copy and retry", () => {
    const reset = vi.fn();
    render(<NewsError error={new Error("private database detail")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Не удалось загрузить новости" })).toBeVisible();
    expect(screen.getByText("Попробуйте загрузить страницу еще раз.")).toBeVisible();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();

    const source = readFileSync(join(process.cwd(), "src/app/news/error.tsx"), "utf8");
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/error:\s*Error\s*&\s*\{\s*digest\?:\s*string\s*\}/);
    expect(source).toMatch(/reset:\s*\(\)\s*=>\s*void/);
  });
});
