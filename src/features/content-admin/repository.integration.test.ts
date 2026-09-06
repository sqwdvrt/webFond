import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deleteDocument,
  deleteNews,
  deleteProject,
  updateProject,
} from "./repository";

const databaseUrlValue = process.env.CONTENT_REPOSITORY_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrlValue ? describe : describe.skip;
const HOOK_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 15_000;
const fixturePrefix = `repository-${randomUUID()}`;

function validatedConnection(value: string) {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Content repository tests require PostgreSQL");
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Content repository tests require a local PostgreSQL host");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "Content repository tests require a database ending in _test",
    );
  }

  url.search = "";
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("connect_timeout", "5");
  url.searchParams.set("pool_timeout", "5");
  return url.toString();
}

describeWithDatabase("content repository concurrency against PostgreSQL", () => {
  let client: PrismaClient | null = null;

  async function cleanupFixtures() {
    if (!client) return;

    await client.$transaction([
      client.project.deleteMany({ where: { id: { startsWith: fixturePrefix } } }),
      client.newsPost.deleteMany({ where: { id: { startsWith: fixturePrefix } } }),
      client.document.deleteMany({ where: { id: { startsWith: fixturePrefix } } }),
    ]);
  }

  beforeAll(async () => {
    const connection = validatedConnection(databaseUrlValue!);
    client = new PrismaClient({ datasourceUrl: connection });

    try {
      await client.$connect();
    } catch (primaryError) {
      await client.$disconnect().catch(() => undefined);
      client = null;
      throw primaryError;
    }
  }, HOOK_TIMEOUT_MS);

  afterEach(async () => {
    await cleanupFixtures();
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (!client) return;

    try {
      await cleanupFixtures();
    } finally {
      await client.$disconnect();
      client = null;
    }
  }, HOOK_TIMEOUT_MS);

  it(
    "advances updatedAt and rejects reuse of the old update token",
    async () => {
      const prisma = client!;
      const id = `${fixturePrefix}-update-project`;
      const oldUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
      const created = await prisma.project.create({
        data: {
          id,
          title: "Original title",
          slug: `${fixturePrefix}-update-project`,
          summary: "Original summary",
          content: "Original content",
          imageUrl: null,
          status: "DRAFT",
          publishedAt: null,
          updatedAt: oldUpdatedAt,
        },
      });

      const firstUpdate = await updateProject(
        id,
        created.updatedAt,
        {
          title: "Newer title",
          slug: `${fixturePrefix}-update-project-newer`,
          summary: "Newer summary",
          content: "Newer content",
          imageUrl: null,
          status: "DRAFT",
          goalAmountKopecks: null,
          manualRaisedKopecks: 0,
        },
        prisma,
      );
      expect(firstUpdate.status).toBe("ok");

      const afterFirstUpdate = await prisma.project.findUniqueOrThrow({
        where: { id },
      });
      expect(afterFirstUpdate.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      );

      const staleUpdate = await updateProject(
        id,
        created.updatedAt,
        {
          title: "Stale title",
          slug: `${fixturePrefix}-update-project-stale`,
          summary: "Stale summary",
          content: "Stale content",
          imageUrl: null,
          status: "DRAFT",
          goalAmountKopecks: null,
          manualRaisedKopecks: 0,
        },
        prisma,
      );
      expect(staleUpdate).toEqual({ status: "conflict" });

      const afterStaleUpdate = await prisma.project.findUniqueOrThrow({
        where: { id },
      });
      expect(afterStaleUpdate).toMatchObject({
        title: "Newer title",
        slug: `${fixturePrefix}-update-project-newer`,
        content: "Newer content",
        updatedAt: afterFirstUpdate.updatedAt,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "prevents stale deletes after another writer publishes each content type",
    async () => {
      const prisma = client!;
      const oldUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
      const projectId = `${fixturePrefix}-delete-project`;
      const newsId = `${fixturePrefix}-delete-news`;
      const documentId = `${fixturePrefix}-delete-document`;
      const [project, news, document] = await prisma.$transaction([
        prisma.project.create({
          data: {
            id: projectId,
            title: "Draft project",
            slug: projectId,
            status: "DRAFT",
            publishedAt: null,
            updatedAt: oldUpdatedAt,
          },
        }),
        prisma.newsPost.create({
          data: {
            id: newsId,
            title: "Draft news",
            slug: newsId,
            status: "DRAFT",
            publishedAt: null,
            updatedAt: oldUpdatedAt,
          },
        }),
        prisma.document.create({
          data: {
            id: documentId,
            title: "Draft document",
            category: "REPORT",
            fileUrl: `/${documentId}.pdf`,
            status: "DRAFT",
            publishedAt: null,
            updatedAt: oldUpdatedAt,
          },
        }),
      ]);
      const publishedAt = new Date();

      await prisma.$transaction([
        prisma.project.update({
          where: { id: projectId },
          data: { status: "PUBLISHED", publishedAt },
        }),
        prisma.newsPost.update({
          where: { id: newsId },
          data: { status: "PUBLISHED", publishedAt },
        }),
        prisma.document.update({
          where: { id: documentId },
          data: { status: "PUBLISHED", publishedAt },
        }),
      ]);

      await expect(
        Promise.all([
          deleteProject(projectId, project.updatedAt, prisma),
          deleteNews(newsId, news.updatedAt, prisma),
          deleteDocument(documentId, document.updatedAt, prisma),
        ]),
      ).resolves.toEqual([
        { status: "forbidden" },
        { status: "forbidden" },
        { status: "forbidden" },
      ]);

      const [storedProject, storedNews, storedDocument] =
        await prisma.$transaction([
          prisma.project.findUnique({ where: { id: projectId } }),
          prisma.newsPost.findUnique({ where: { id: newsId } }),
          prisma.document.findUnique({ where: { id: documentId } }),
        ]);
      expect([storedProject, storedNews, storedDocument]).toEqual([
        expect.objectContaining({ id: projectId, status: "PUBLISHED" }),
        expect.objectContaining({ id: newsId, status: "PUBLISHED" }),
        expect.objectContaining({ id: documentId, status: "PUBLISHED" }),
      ]);
    },
    TEST_TIMEOUT_MS,
  );
});
