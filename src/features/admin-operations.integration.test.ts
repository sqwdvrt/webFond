import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAuditedDocument,
  createAuditedNews,
  createAuditedProject,
  deleteAuditedDocument,
  deleteAuditedNews,
  deleteAuditedProject,
  updateAuditedDocument,
  updateAuditedNews,
  updateAuditedProject,
} from "@/features/admin-audit/content-repository";
import { getAdminDashboardReadModel } from "@/features/admin-dashboard/read-model";
import { parseContactPageFilters } from "@/features/admin-messages/filters";
import { moveContactSelection } from "@/features/admin-messages/bulk";
import { getAuditPage } from "@/features/admin-audit/history";
import { updateContactRequest } from "@/features/admin-messages/mutation";
import { getContactRequestPage } from "@/features/admin-messages/repository";
import type { PublicationStatus } from "@/features/content-admin/types";
import { defaultSaveContact } from "@/features/contact/submit";

const databaseUrlValue = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrlValue ? describe : describe.skip;
const PROCESS_TIMEOUT_MS = 60_000;
const HOOK_TIMEOUT_MS = 90_000;
const TEST_TIMEOUT_MS = 30_000;
const schemaName = `admin_operations_app_${randomUUID().replaceAll("-", "")}`;
const prismaCli = resolve(process.cwd(), "node_modules/.bin/prisma");
const prismaSchema = resolve(process.cwd(), "prisma/schema.prisma");

function validatedConnection(value: string) {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Admin operations integration tests require PostgreSQL");
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(
      "Admin operations integration tests require a local PostgreSQL host",
    );
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "Admin operations integration tests require a database ending in _test",
    );
  }

  url.search = "";
  return url;
}

function connectionForSchema(base: URL) {
  const scoped = new URL(base);
  scoped.searchParams.set("schema", schemaName);
  return scoped.toString();
}

function parsedContactFilters(input: Record<string, string>) {
  const parsed = parseContactPageFilters(input);
  if (!parsed.ok) throw new Error("Expected valid contact filters");
  return parsed.value;
}

describeWithDatabase("admin operations application integration", () => {
  let connection = "";
  let scopedConnection = "";
  let client: PrismaClient;

  function psql(...args: string[]) {
    return execFileSync(
      "psql",
      ["--dbname", connection, "-X", "-v", "ON_ERROR_STOP=1", ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PGCONNECT_TIMEOUT: "5",
          PGOPTIONS: "-c lock_timeout=5000 -c statement_timeout=30000",
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: PROCESS_TIMEOUT_MS,
      },
    );
  }

  function dropSchema() {
    if (!connection) return;
    psql("-c", `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }

  async function cleanupAfterSetupFailure(primaryError: unknown): Promise<never> {
    try {
      await client?.$disconnect();
    } catch {
      // Preserve the setup error; schema cleanup is attempted independently.
    }
    try {
      dropSchema();
    } catch {
      try {
        process.stderr.write(
          "Failed to clean up isolated admin operations application schema after setup failure\n",
        );
      } catch {
        // Preserve the setup error even if reporting cleanup failure fails.
      }
    }
    throw primaryError;
  }

  beforeAll(async () => {
    const base = validatedConnection(databaseUrlValue!);
    connection = base.toString();
    scopedConnection = connectionForSchema(base);

    try {
      psql("-c", `CREATE SCHEMA "${schemaName}"`);
      execFileSync(
        prismaCli,
        ["migrate", "deploy", "--schema", prismaSchema],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_URL: scopedConnection,
            DATABASE_URL_UNPOOLED: scopedConnection,
          },
          stdio: ["ignore", "pipe", "pipe"],
          timeout: PROCESS_TIMEOUT_MS,
        },
      );
      client = new PrismaClient({ datasourceUrl: scopedConnection });
      await client.$connect();
    } catch (primaryError) {
      await cleanupAfterSetupFailure(primaryError);
    }
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    try {
      await client?.$disconnect();
    } finally {
      dropSchema();
    }
  }, HOOK_TIMEOUT_MS);

  it("searches and pages contacts through the application repository", async () => {
    const inside = new Date("2026-10-16T10:00:00.000Z");
    const contacts = Array.from({ length: 30 }, (_, index) => ({
      id: `queue-${String(index).padStart(2, "0")}`,
      name: index === 29 ? "Ирина Имя-Маркер" : `Посетитель ${index}`,
      email: index === 28 ? "email-marker@example.test" : `person${index}@example.test`,
      message: index === 27 ? "Текст с message-marker" : `Обращение ${index}`,
      status: "NEW" as const,
      createdAt: inside,
      updatedAt: inside,
    }));

    await client.contactRequest.createMany({ data: contacts });
    await client.contactRequest.create({
      data: {
        id: "queue-closed",
        name: "Ирина Имя-Маркер",
        email: "closed@example.test",
        message: "Закрытое обращение",
        status: "CLOSED",
        createdAt: inside,
        updatedAt: inside,
      },
    });
    await client.contactRequest.createMany({
      data: [
        {
          id: "queue-before-date",
          name: "outside-date-marker",
          email: "before@example.test",
          message: "До московского дня",
          status: "NEW",
          createdAt: new Date("2026-10-15T20:59:59.999Z"),
          updatedAt: inside,
        },
        {
          id: "queue-at-date-end",
          name: "outside-date-marker",
          email: "after@example.test",
          message: "На исключающей границе московского дня",
          status: "NEW",
          createdAt: new Date("2026-10-16T21:00:00.000Z"),
          updatedAt: inside,
        },
      ],
    });

    const firstPage = await getContactRequestPage(
      parsedContactFilters({ status: "NEW", from: "2026-10-16", to: "2026-10-16" }),
      client as never,
    );
    expect(firstPage).toMatchObject({
      total: 30,
      totalPages: 2,
      page: 1,
      pageSize: 25,
    });
    expect(firstPage.rows).toHaveLength(25);
    expect(firstPage.rows.map(({ id }) => id)).toEqual(
      Array.from({ length: 25 }, (_, index) => `queue-${String(29 - index).padStart(2, "0")}`),
    );

    const clampedPage = await getContactRequestPage(
      parsedContactFilters({ status: "NEW", from: "2026-10-16", to: "2026-10-16", page: "99" }),
      client as never,
    );
    expect(clampedPage.page).toBe(2);
    expect(clampedPage.rows.map(({ id }) => id)).toEqual([
      "queue-04",
      "queue-03",
      "queue-02",
      "queue-01",
      "queue-00",
    ]);

    for (const [query, expectedId] of [
      ["Имя-Маркер", "queue-29"],
      ["EMAIL-MARKER", "queue-28"],
      ["message-marker", "queue-27"],
    ] as const) {
      const result = await getContactRequestPage(
        parsedContactFilters({
          q: query,
          status: "NEW",
          from: "2026-10-16",
          to: "2026-10-16",
        }),
        client as never,
      );
      expect(result.total).toBe(1);
      expect(result.rows.map(({ id }) => id)).toEqual([expectedId]);
    }

    const outsideDate = await getContactRequestPage(
      parsedContactFilters({
        q: "outside-date-marker",
        status: "NEW",
        from: "2026-10-16",
        to: "2026-10-16",
      }),
      client as never,
    );
    expect(outsideDate).toMatchObject({ total: 0, page: 1, totalPages: 1 });
    expect(outsideDate.rows).toEqual([]);
  }, TEST_TIMEOUT_MS);

  it("uses paidAt half-open Moscow intervals and strict stale cutoffs", async () => {
    const now = new Date("2026-10-16T12:00:00.000Z");
    const donationRows = [
      ["before-month", 100, "2026-09-30T20:59:59.999Z"],
      ["at-month-start", 200, "2026-09-30T21:00:00.000Z"],
      ["before-day", 300, "2026-10-15T20:59:59.999Z"],
      ["at-day-start", 400, "2026-10-15T21:00:00.000Z"],
      ["before-day-end", 500, "2026-10-16T20:59:59.999Z"],
      ["at-day-end", 600, "2026-10-16T21:00:00.000Z"],
      ["at-month-end", 700, "2026-10-31T21:00:00.000Z"],
    ] as const;

    await client.donation.createMany({
      data: donationRows.map(([id, amountKopecks, paidAt]) => ({
        id: `donation-${id}`,
        idempotenceKey: `idempotence-${id}`,
        amountKopecks,
        status: "SUCCEEDED" as const,
        paidAt: new Date(paidAt),
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      })),
    });
    await client.donation.createMany({
      data: [
        {
          id: "pending-at-cutoff",
          idempotenceKey: "pending-at-cutoff",
          amountKopecks: 800,
          status: "PENDING",
          createdAt: new Date("2026-10-16T11:00:00.000Z"),
          updatedAt: now,
        },
        {
          id: "pending-before-cutoff",
          idempotenceKey: "pending-before-cutoff",
          amountKopecks: 900,
          status: "PENDING",
          createdAt: new Date("2026-10-16T10:59:59.999Z"),
          updatedAt: now,
        },
      ],
    });
    await client.contactRequest.createMany({
      data: [
        {
          id: "contact-at-cutoff",
          name: "Ровно 48 часов",
          email: "equal@example.test",
          message: "Граница",
          status: "NEW",
          createdAt: new Date("2026-10-14T12:00:00.000Z"),
          updatedAt: now,
        },
        {
          id: "contact-before-cutoff",
          name: "Старше 48 часов",
          email: "older@example.test",
          message: "На миллисекунду старше",
          status: "NEW",
          createdAt: new Date("2026-10-14T11:59:59.999Z"),
          updatedAt: now,
        },
      ],
    });
    const [
      baselineActiveCount,
      baselinePublishedProjectCount,
      baselineDraftProjectCount,
      baselineDraftNewsPostCount,
      baselineDraftDocumentCount,
    ] = await Promise.all([
      client.contactRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] }, folder: "INBOX" } }),
      client.project.count({ where: { status: "PUBLISHED" } }),
      client.project.count({ where: { status: "DRAFT" } }),
      client.newsPost.count({ where: { status: "DRAFT" } }),
      client.document.count({ where: { status: "DRAFT" } }),
    ]);
    await client.contactRequest.create({
      data: {
        id: "contact-in-progress-dashboard",
        name: "Обращение в работе",
        email: "in-progress@example.test",
        message: "Активное обращение",
        status: "IN_PROGRESS",
        createdAt: now,
        updatedAt: now,
      },
    });
    await client.project.createMany({
      data: [
        {
          id: "dashboard-project-published",
          title: "Опубликованный проект dashboard",
          slug: "dashboard-project-published",
          status: "PUBLISHED",
          publishedAt: now,
        },
        {
          id: "dashboard-project-draft",
          title: "Черновик проекта dashboard",
          slug: "dashboard-project-draft",
          status: "DRAFT",
        },
      ],
    });
    await client.newsPost.create({
      data: {
        id: "dashboard-news-draft",
        title: "Черновик новости dashboard",
        slug: "dashboard-news-draft",
        status: "DRAFT",
      },
    });
    await client.document.create({
      data: {
        id: "dashboard-document-draft",
        title: "Черновик документа dashboard",
        category: "REPORT",
        fileUrl: "/documents/dashboard-document-draft.pdf",
        status: "DRAFT",
      },
    });
    const auditRows = Array.from({ length: 11 }, (_, index) => ({
      id: `dashboard-audit-${String(index).padStart(2, "0")}`,
      action: "CONTENT_PUBLISHED" as const,
      entityType: "PROJECT" as const,
      entityId: `dashboard-audit-project-${String(index).padStart(2, "0")}`,
      previousStatus: "DRAFT",
      nextStatus: "PUBLISHED",
      createdAt: new Date(Date.UTC(2099, 0, 1, 0, 0, index)),
    }));
    await client.adminAuditEvent.createMany({ data: auditRows });

    try {
      const model = await getAdminDashboardReadModel(now, {
        database: client as never,
        evaluateReadiness: () => ({ ok: true as const, issues: [] }),
      });

      expect(model.donations.today).toEqual({ count: 2, amountKopecks: 900 });
      expect(model.donations.month).toEqual({ count: 5, amountKopecks: 2_000 });
      expect(model.messages.activeCount).toBe(baselineActiveCount + 1);
      expect(model.content).toEqual({
        publishedProjectCount: baselinePublishedProjectCount + 1,
        draftCount:
          baselineDraftProjectCount
          + baselineDraftNewsPostCount
          + baselineDraftDocumentCount
          + 3,
      });
      expect(model.alerts).toEqual([
        expect.objectContaining({
          code: "STALE_PENDING_DONATIONS",
          href: "/admin/donations?status=PENDING&stale=1",
        }),
        expect.objectContaining({
          code: "STALE_NEW_CONTACTS",
          href: "/admin/messages?status=NEW&before=2026-10-14T12%3A00%3A00.000Z",
        }),
      ]);
      expect(model.alerts[0]?.message).toContain(": 1.");
      expect(model.alerts[1]?.message).toContain(": 1.");
      expect(model.recentActivity).toHaveLength(5);
      expect(model.recentActivity.map(({ id }) => id)).toEqual(
        auditRows.slice(-5).reverse().map(({ id }) => id),
      );
      for (const event of model.recentActivity) {
        expect(event).not.toHaveProperty("entityId");
      }
    } finally {
      await client.adminAuditEvent.deleteMany({
        where: { id: { startsWith: "dashboard-audit-" } },
      });
    }
  }, TEST_TIMEOUT_MS);

  it("keeps contact audit rows private and rolls back when audit insertion fails", async () => {
    const originalUpdatedAt = new Date("2026-10-16T09:00:00.000Z");
    const privateNote = "PRIVATE-NOTE-MUST-NOT-ENTER-AUDIT";
    await client.contactRequest.create({
      data: {
        id: "contact-audit-target",
        name: "Private Person",
        email: "private-person@example.test",
        message: "PRIVATE-MESSAGE-MUST-NOT-ENTER-AUDIT",
        status: "NEW",
        internalNote: "original note",
        createdAt: originalUpdatedAt,
        updatedAt: originalUpdatedAt,
      },
    });

    const auditFailure = new Error("forced audit insertion failure");
    const failingClient = {
      $transaction: <Result>(
        callback: (transaction: {
          contactRequest: PrismaClient["contactRequest"];
          adminAuditEvent: { createMany(): Promise<never> };
        }) => Promise<Result>,
      ) => client.$transaction((tx) => callback({
        contactRequest: tx.contactRequest as PrismaClient["contactRequest"],
        adminAuditEvent: {
          createMany: async () => { throw auditFailure; },
        },
      })),
    };

    await expect(updateContactRequest(
      "contact-audit-target",
      originalUpdatedAt,
      { status: "IN_PROGRESS", note: privateNote },
      failingClient as never,
    )).rejects.toBe(auditFailure);
    await expect(client.contactRequest.findUniqueOrThrow({
      where: { id: "contact-audit-target" },
      select: { status: true, internalNote: true },
    })).resolves.toEqual({ status: "NEW", internalNote: "original note" });
    expect(await client.adminAuditEvent.count({
      where: { entityId: "contact-audit-target" },
    })).toBe(0);

    await expect(updateContactRequest(
      "contact-audit-target",
      originalUpdatedAt,
      { status: "IN_PROGRESS", note: privateNote },
      client as never,
    )).resolves.toEqual({ status: "ok" });

    const rows = await client.adminAuditEvent.findMany({
      where: { entityId: "contact-audit-target" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const safeRows = rows.map(({ action, entityType, previousStatus, nextStatus }) => ({
      action,
      entityType,
      previousStatus,
      nextStatus,
    }));
    expect(safeRows).toHaveLength(2);
    expect(safeRows).toEqual(expect.arrayContaining([
      {
        action: "CONTACT_STATUS_CHANGED",
        entityType: "CONTACT_REQUEST",
        previousStatus: "NEW",
        nextStatus: "IN_PROGRESS",
      },
      {
        action: "CONTACT_NOTE_CHANGED",
        entityType: "CONTACT_REQUEST",
        previousStatus: null,
        nextStatus: null,
      },
    ]));
    expect(JSON.stringify(rows)).not.toContain(privateNote);
    expect(JSON.stringify(rows)).not.toContain("private-person@example.test");
    expect(JSON.stringify(rows)).not.toContain("PRIVATE-MESSAGE");

    const columns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'AdminAuditEvent'
      ORDER BY ordinal_position
    `;
    expect(columns.map(({ column_name }) => column_name)).toEqual([
      "id",
      "actorKind",
      "action",
      "entityType",
      "entityId",
      "previousStatus",
      "nextStatus",
      "createdAt",
      "changedFields",
    ]);

    const auditCount = await client.adminAuditEvent.count();
    await expect(defaultSaveContact(
      {
        name: "Public Contact",
        email: "public-contact@example.test",
        message: "Public submission",
      },
      "admin-operations-integration-client",
      new Date("2026-10-16T13:00:00.000Z"),
      client as never,
    )).resolves.toBe("ok");
    expect(await client.adminAuditEvent.count()).toBe(auditCount);
  }, TEST_TIMEOUT_MS);

  it("rolls back content create, update, and delete when audit insertion fails", async () => {
    const auditFailure = new Error("forced content audit insertion failure");
    const failingAuditClient = (
      delegateName: "project" | "newsPost" | "document",
    ) => ({
      $transaction: <Result>(
        callback: (transaction: never) => Promise<Result>,
      ) => client.$transaction((transaction) => callback({
        [delegateName]: transaction[delegateName],
        adminAuditEvent: {
          createMany: async () => { throw auditFailure; },
        },
      } as never)),
    });

    await expect(createAuditedProject({
      title: "Rollback create",
      slug: "rollback-create",
      summary: null,
      content: null,
      imageUrl: null,
      status: "DRAFT",
      goalAmountKopecks: null,
      manualRaisedKopecks: 0,
    }, failingAuditClient("project") as never)).rejects.toBe(auditFailure);
    expect(await client.project.count({
      where: { slug: "rollback-create" },
    })).toBe(0);

    const news = await client.newsPost.create({
      data: {
        id: "rollback-update-news",
        title: "Before rollback",
        slug: "rollback-update-news",
        status: "DRAFT",
      },
    });
    await expect(updateAuditedNews(news.id, news.updatedAt, {
      title: "After rollback",
      slug: news.slug,
      summary: null,
      content: null,
      imageUrl: null,
      status: "PUBLISHED",
    }, failingAuditClient("newsPost") as never)).rejects.toBe(auditFailure);
    await expect(client.newsPost.findUniqueOrThrow({
      where: { id: news.id },
      select: { title: true, status: true, publishedAt: true },
    })).resolves.toEqual({
      title: "Before rollback",
      status: "DRAFT",
      publishedAt: null,
    });

    const document = await client.document.create({
      data: {
        id: "rollback-delete-document",
        title: "Rollback delete",
        category: "REPORT",
        fileUrl: "/documents/rollback-delete.pdf",
        status: "DRAFT",
      },
    });
    await expect(deleteAuditedDocument(
      document.id,
      document.updatedAt,
      failingAuditClient("document") as never,
    )).rejects.toBe(auditFailure);
    expect(await client.document.count({
      where: { id: document.id },
    })).toBe(1);
    expect(await client.adminAuditEvent.count({
      where: {
        entityId: { in: [news.id, document.id] },
      },
    })).toBe(0);
  }, TEST_TIMEOUT_MS);

  it("audits create, publish, archive, and delete through every content wrapper", async () => {
    type LifecycleResult = { status: string; id?: string };
    type LifecycleSubject = {
      entityType: "PROJECT" | "NEWS_POST" | "DOCUMENT";
      create(status: PublicationStatus, suffix: string): Promise<LifecycleResult>;
      updatedAt(id: string): Promise<Date>;
      update(id: string, updatedAt: Date, status: PublicationStatus, suffix: string): Promise<LifecycleResult>;
      delete(id: string, updatedAt: Date): Promise<LifecycleResult>;
    };

    const subjects: LifecycleSubject[] = [
      {
        entityType: "PROJECT",
        create: (status, suffix) => createAuditedProject({
          title: `Project ${suffix}`,
          slug: `project-${suffix}`,
          summary: null,
          content: null,
          imageUrl: null,
          status,
          goalAmountKopecks: null,
          manualRaisedKopecks: 0,
        }, client as never),
        updatedAt: async (id) => (await client.project.findUniqueOrThrow({
          where: { id }, select: { updatedAt: true },
        })).updatedAt,
        update: (id, updatedAt, status, suffix) => updateAuditedProject(id, updatedAt, {
          title: `Project ${suffix}`,
          slug: `project-${suffix}`,
          summary: null,
          content: null,
          imageUrl: null,
          status,
          goalAmountKopecks: null,
          manualRaisedKopecks: 0,
        }, client as never),
        delete: (id, updatedAt) => deleteAuditedProject(id, updatedAt, client as never),
      },
      {
        entityType: "NEWS_POST",
        create: (status, suffix) => createAuditedNews({
          title: `News ${suffix}`,
          slug: `news-${suffix}`,
          summary: null,
          content: null,
          imageUrl: null,
          status,
        }, client as never),
        updatedAt: async (id) => (await client.newsPost.findUniqueOrThrow({
          where: { id }, select: { updatedAt: true },
        })).updatedAt,
        update: (id, updatedAt, status, suffix) => updateAuditedNews(id, updatedAt, {
          title: `News ${suffix}`,
          slug: `news-${suffix}`,
          summary: null,
          content: null,
          imageUrl: null,
          status,
        }, client as never),
        delete: (id, updatedAt) => deleteAuditedNews(id, updatedAt, client as never),
      },
      {
        entityType: "DOCUMENT",
        create: (status, suffix) => createAuditedDocument({
          title: `Document ${suffix}`,
          category: "REPORT",
          fileUrl: `/documents/${suffix}.pdf`,
          status,
        }, client as never),
        updatedAt: async (id) => (await client.document.findUniqueOrThrow({
          where: { id }, select: { updatedAt: true },
        })).updatedAt,
        update: (id, updatedAt, status, suffix) => updateAuditedDocument(id, updatedAt, {
          title: `Document ${suffix}`,
          category: "REPORT",
          fileUrl: `/documents/${suffix}.pdf`,
          status,
        }, client as never),
        delete: (id, updatedAt) => deleteAuditedDocument(id, updatedAt, client as never),
      },
    ];

    const entityIds: string[] = [];
    for (const [index, subject] of subjects.entries()) {
      const lifecycleSuffix = `lifecycle-${index}`;
      const created = await subject.create("DRAFT", lifecycleSuffix);
      expect(created.status).toBe("ok");
      if (!created.id) throw new Error("Expected created content id");
      entityIds.push(created.id);

      const published = await subject.update(
        created.id,
        await subject.updatedAt(created.id),
        "PUBLISHED",
        lifecycleSuffix,
      );
      expect(published.status).toBe("ok");
      const archived = await subject.update(
        created.id,
        await subject.updatedAt(created.id),
        "ARCHIVED",
        lifecycleSuffix,
      );
      expect(archived.status).toBe("ok");

      const deleteSuffix = `delete-${index}`;
      const deleteCandidate = await subject.create("DRAFT", deleteSuffix);
      expect(deleteCandidate.status).toBe("ok");
      if (!deleteCandidate.id) throw new Error("Expected delete candidate id");
      entityIds.push(deleteCandidate.id);
      await expect(subject.delete(
        deleteCandidate.id,
        await subject.updatedAt(deleteCandidate.id),
      )).resolves.toEqual({ status: "ok", id: deleteCandidate.id });
    }

    const rows = await client.adminAuditEvent.findMany({
      where: { entityId: { in: entityIds } },
      select: {
        action: true,
        entityType: true,
        entityId: true,
        previousStatus: true,
        nextStatus: true,
      },
    });
    expect(rows).toHaveLength(15);
    for (const subject of subjects) {
      const subjectRows = rows.filter(({ entityType }) => entityType === subject.entityType);
      expect(subjectRows.map(({ action }) => action)).toEqual(expect.arrayContaining([
        "CONTENT_CREATED",
        "CONTENT_PUBLISHED",
        "CONTENT_ARCHIVED",
        "CONTENT_DELETED",
      ]));
      expect(subjectRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          action: "CONTENT_PUBLISHED",
          previousStatus: "DRAFT",
          nextStatus: "PUBLISHED",
        }),
        expect.objectContaining({
          action: "CONTENT_ARCHIVED",
          previousStatus: "PUBLISHED",
          nextStatus: "ARCHIVED",
        }),
        expect.objectContaining({
          action: "CONTENT_DELETED",
          previousStatus: "DRAFT",
          nextStatus: null,
        }),
      ]));
    }
  }, TEST_TIMEOUT_MS);
  it("atomically moves selected contacts, excludes other folders from the inbox and restores workflow state", async () => {
    const contacts = await Promise.all(["a", "b"].map((suffix) => client.contactRequest.create({ data: {
      name: `Bulk ${suffix}`, email: "bulk@example.org", message: "Bulk test", status: "IN_PROGRESS",
    } })));
    const rows = contacts.map(({ id, updatedAt }) => ({ id, updatedAt }));
    // A stale second row must roll back an already updated first row.
    const staleRows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    staleRows[1] = { ...staleRows[1], updatedAt: new Date(0) };
    await expect(moveContactSelection({ source: "INBOX", target: "ARCHIVE", rows: staleRows }, client)).rejects.toThrow("contact_selection_conflict");
    expect(await client.contactRequest.count({ where: { id: { in: rows.map((row) => row.id) }, folder: "INBOX" } })).toBe(2);
    expect(await client.adminAuditEvent.count({ where: { entityId: { in: rows.map((row) => row.id) } } })).toBe(0);

    await moveContactSelection({ source: "INBOX", target: "ARCHIVE", rows }, client);
    const archived = await getContactRequestPage({ page: 1, folder: "ARCHIVE" }, client);
    expect(archived.rows.map(({ id }) => id)).toEqual(expect.arrayContaining(rows.map(({ id }) => id)));
    const inbox = await getContactRequestPage({ page: 1 }, client);
    expect(inbox.rows.some((row) => rows.some(({ id }) => row.id === id))).toBe(false);
    await moveContactSelection({ source: "ARCHIVE", target: "TRASH", rows: archived.rows.filter((row) => rows.some(({ id }) => row.id === id)).map(({ id, updatedAt }) => ({ id, updatedAt })) }, client);
    const trash = await client.contactRequest.findMany({ where: { id: { in: rows.map(({ id }) => id) } } });
    expect(trash.every((row) => row.folder === "TRASH" && row.status === "IN_PROGRESS")).toBe(true);
    await moveContactSelection({ source: "TRASH", target: "INBOX", rows: trash.map(({ id, updatedAt }) => ({ id, updatedAt })) }, client);
    expect(await client.contactRequest.count({ where: { id: { in: rows.map(({ id }) => id) }, folder: "INBOX", status: "IN_PROGRESS" } })).toBe(2);
    const audit = await client.adminAuditEvent.findMany({ where: { entityId: { in: rows.map(({ id }) => id) } } });
    expect(audit).toHaveLength(6);
    expect(audit.every((row) => row.action === "CONTACT_FOLDER_CHANGED")).toBe(true);
    const history = await getAuditPage(1, client);
    expect(history.rows.length).toBeLessThanOrEqual(25);
  }, TEST_TIMEOUT_MS);

});
