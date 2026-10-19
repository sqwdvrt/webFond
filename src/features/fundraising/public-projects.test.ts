import { describe, expect, it, vi } from "vitest";

import {
  findPublishedProjectIdBySlug,
  getPublishedProjectForDisplay,
  listPublishedProjectDonationOptions,
  listPublishedProjectsForDisplay,
  listHomeProjectsForDisplay,
} from "./public-projects";

const publishedAt = new Date("2026-08-22T10:00:00.000Z");

const row = {
  id: "project-1",
  title: "Опубликованный проект",
  slug: "published-project",
  summary: "Описание",
  imageUrl: "/media/project.jpg",
  publishedAt,
  goalAmountKopecks: 100_000,
  manualRaisedKopecks: 1_000,
  content: "Текст проекта",
};

describe("published project fundraising loaders", () => {
  it("limits homepage projects in the database before aggregating their donations", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ ...row, id: `project-${i}`, goalAmountKopecks: i === 1 ? null : row.goalAmountKopecks }));
    const findMany = vi.fn(async (args: { take?: number }) => rows.slice(0, args.take));
    const groupBy = vi.fn(async () => []);
    const result = await listHomeProjectsForDisplay({ project: { findMany, findFirst: vi.fn() }, donation: { groupBy } });
    expect(result).toHaveLength(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PUBLISHED" }, take: 3,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }));
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("select.content");
    expect(groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["projectId"], where: { status: "SUCCEEDED", projectId: { in: ["project-0", "project-2"] } }, _sum: { amountKopecks: true } });
  });

  it("skips fundraising queries for homepage projects without goals", async () => {
    const groupBy = vi.fn();
    await listHomeProjectsForDisplay({ project: { findMany: vi.fn(async () => [{ ...row, goalAmountKopecks: null }]), findFirst: vi.fn() }, donation: { groupBy } });
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("lists cards with fundraising from succeeded donations and the manual amount", async () => {
    const findMany = vi.fn(async () => [row]);
    const groupBy = vi.fn(async () => [
      { projectId: row.id, _sum: { amountKopecks: 4_000 } },
    ]);

    await expect(
      listPublishedProjectsForDisplay({
        project: { findMany, findFirst: vi.fn() },
        donation: { groupBy },
      }),
    ).resolves.toEqual([
      {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        imageUrl: row.imageUrl,
        publishedAt,
        fundraising: {
          collectedKopecks: 5_000,
          goalKopecks: 100_000,
          fillPercent: 5,
        },
      },
    ]);
    expect(groupBy).toHaveBeenCalledOnce();
  });

  it("does not query donations when no listed project has a goal", async () => {
    const findMany = vi.fn(async () => [
      { ...row, goalAmountKopecks: null, manualRaisedKopecks: 0 },
    ]);
    const groupBy = vi.fn();

    await expect(
      listPublishedProjectsForDisplay({
        project: { findMany, findFirst: vi.fn() },
        donation: { groupBy },
      }),
    ).resolves.toEqual([
      {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        imageUrl: row.imageUrl,
        publishedAt,
        fundraising: null,
      },
    ]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("loads a published detail with fundraising", async () => {
    const findFirst = vi.fn(async () => row);
    const groupBy = vi.fn(async () => [
      { projectId: row.id, _sum: { amountKopecks: 9_000 } },
    ]);

    await expect(
      getPublishedProjectForDisplay("published-project", {
        project: { findMany: vi.fn(), findFirst },
        donation: { groupBy },
      }),
    ).resolves.toMatchObject({
      slug: "published-project",
      content: "Текст проекта",
      fundraising: {
        collectedKopecks: 10_000,
        goalKopecks: 100_000,
        fillPercent: 10,
      },
    });
  });

  it("resolves only a published project id by slug", async () => {
    const findFirst = vi.fn(async () => ({ id: "project-1" }));

    await expect(
      findPublishedProjectIdBySlug("published-project", {
        project: { findMany: vi.fn(), findFirst },
        donation: { groupBy: vi.fn() },
      }),
    ).resolves.toBe("project-1");
    expect(findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { slug: "published-project", status: "PUBLISHED" },
      select: { id: true },
    });
  });

  it("lists donation options from published titles", async () => {
    const findMany = vi.fn(async () => [row]);

    await expect(
      listPublishedProjectDonationOptions({
        project: { findMany },
      }),
    ).resolves.toEqual([{ slug: "published-project", title: row.title }]);
    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: { status: "PUBLISHED" },
      select: { slug: true, title: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
  });
});
