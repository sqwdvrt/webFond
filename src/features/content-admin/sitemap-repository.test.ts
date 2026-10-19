import { describe, expect, it, vi } from "vitest";
import { listSitemapDocuments, listSitemapNews, listSitemapProjects } from "./sitemap-repository";

describe("sitemap projections", () => {
  it("loads only published slugs, without editorial bodies or image URLs", async () => {
    const project = { findMany: vi.fn(async () => [{ slug: "project" }]) };
    const newsPost = { findMany: vi.fn(async () => [{ slug: "news" }]) };
    await expect(listSitemapProjects({ project })).resolves.toEqual([{ slug: "project" }]);
    await expect(listSitemapNews({ newsPost })).resolves.toEqual([{ slug: "news" }]);
    for (const delegate of [project, newsPost]) expect(delegate.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { status: "PUBLISHED" }, select: { slug: true },
    });
  });

  it("checks existence of a single published document", async () => {
    const document = { findFirst: vi.fn(async () => ({ id: "doc" })) };
    await expect(listSitemapDocuments({ document })).resolves.toEqual([{ id: "doc" }]);
    expect(document.findFirst).toHaveBeenCalledExactlyOnceWith({ where: { status: "PUBLISHED" }, select: { id: true } });
    document.findFirst.mockResolvedValueOnce(null as never);
    await expect(listSitemapDocuments({ document })).resolves.toEqual([]);
  });
});
