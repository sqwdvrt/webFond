import { describe, expect, it, vi } from "vitest";

import {
  getAdminDashboardReadModel,
  type DashboardDatabase,
} from "./read-model";

function createDatabase(overrides: {
  contactCounts?: number[];
  projectCounts?: number[];
  newsPostCount?: number;
  documentCount?: number;
  donationCount?: number;
  donationAggregates?: Array<{
    _count: number;
    _sum: { amountKopecks: number | null };
  }>;
  calls?: string[];
  heartbeat?: unknown;
  activity?: object[];
  existingProjects?: { id: string }[];
} = {}) {
  const tx = {
    contactRequest: {
      count: vi.fn()
        .mockResolvedValueOnce(overrides.contactCounts?.[0] ?? 7)
        .mockResolvedValueOnce(overrides.contactCounts?.[1] ?? 5)
        .mockResolvedValueOnce(overrides.contactCounts?.[2] ?? 2),
    },
    project: {
      findMany: vi.fn().mockResolvedValue(overrides.existingProjects ?? []),
      count: vi.fn()
        .mockResolvedValueOnce(overrides.projectCounts?.[0] ?? 11)
        .mockResolvedValueOnce(overrides.projectCounts?.[1] ?? 3),
    },
    newsPost: {
      count: vi.fn().mockResolvedValue(overrides.newsPostCount ?? 4),
    },
    document: {
      count: vi.fn().mockResolvedValue(overrides.documentCount ?? 5),
    },
    donation: {
      count: vi.fn().mockResolvedValue(overrides.donationCount ?? 3),
      aggregate: vi.fn()
        .mockResolvedValueOnce(overrides.donationAggregates?.[0] ?? {
          _count: 4,
          _sum: { amountKopecks: 125_500 },
        })
        .mockResolvedValueOnce(overrides.donationAggregates?.[1] ?? {
          _count: 18,
          _sum: { amountKopecks: 990_000 },
        }),
    },
    adminAuditEvent: {
      findMany: vi.fn().mockResolvedValue(overrides.activity ?? [
        {
          id: "audit-1",
          action: "CONTENT_PUBLISHED",
          entityType: "PROJECT",
          previousStatus: "DRAFT",
          nextStatus: "PUBLISHED",
          createdAt: new Date("2026-01-31T22:00:00.000Z"),
        },
      ]),
    },
    siteSetting: {
      findUnique: vi.fn().mockResolvedValue(overrides.heartbeat === undefined ? null : { value: overrides.heartbeat }),
    },
  };
  const database = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => {
      overrides.calls?.push("transaction");
      return callback(tx);
    }),
  };

  return { database: database as unknown as DashboardDatabase, tx };
}

describe("getAdminDashboardReadModel", () => {
  it.each([undefined, { completedAt: "invalid", failed: 0 }, { completedAt: "2026-10-20T12:00:00.000Z", failed: 0 }, { completedAt: "2026-10-19T11:50:00.000Z", failed: "secret" }])("warns safely for an absent or malformed enabled heartbeat: %j", async (heartbeat) => {
    const { database, tx } = createDatabase({ heartbeat });
    const model = await getAdminDashboardReadModel(new Date("2026-10-19T12:00:00.000Z"), { database, evaluateReadiness: () => ({ ok: true, issues: [] }), paymentsEnabled: () => true });
    expect(tx.siteSetting.findUnique).toHaveBeenCalledWith({ where: { key: "paymentsReconciliationHeartbeat" }, select: { value: true } });
    expect(model.reconciliation).toEqual({ enabled: true, completedAt: null, failed: null });
    expect(model.alerts.some((alert) => alert.code === "PAYMENTS_RECONCILIATION_STALE")).toBe(true);
  });

  it("reads the latest valid completion and skips heartbeat access when disabled", async () => {
    const { database, tx } = createDatabase({ heartbeat: { completedAt: "2026-10-19T11:55:00.000Z", failed: 0 } });
    const deps = { database, evaluateReadiness: () => ({ ok: true as const, issues: [] as [] }), paymentsEnabled: () => false };
    await getAdminDashboardReadModel(new Date("2026-10-19T12:00:00.000Z"), deps);
    expect(tx.siteSetting.findUnique).not.toHaveBeenCalled();
    const enabled = createDatabase({ heartbeat: { completedAt: "2026-10-19T11:55:00.000Z", failed: 0 } });
    const model = await getAdminDashboardReadModel(new Date("2026-10-19T12:00:00.000Z"), { ...deps, database: enabled.database, paymentsEnabled: () => true });
    expect(model.reconciliation?.completedAt).toEqual(new Date("2026-10-19T11:55:00.000Z"));
    expect(model.alerts.some((alert) => alert.code === "PAYMENTS_RECONCILIATION_STALE")).toBe(false);
  });

  it("links only existing audit objects and strips their internal identity from the view model", async () => {
    const event = { id: "audit-1", entityId: "project-1", entityType: "PROJECT", action: "CONTENT_UPDATED", previousStatus: null, nextStatus: null, createdAt: new Date("2026-10-19T11:00:00.000Z") };
    for (const exists of [false, true]) {
      const { database } = createDatabase({ activity: [event], existingProjects: exists ? [{ id: "project-1" }] : [] });
      const model = await getAdminDashboardReadModel(new Date("2026-10-19T12:00:00.000Z"), { database, evaluateReadiness: () => ({ ok: true, issues: [] }), paymentsEnabled: () => false });
      expect(model.recentActivity[0]?.href).toBe(exists ? "/admin/projects/project-1" : null);
      expect(model.recentActivity[0]).not.toHaveProperty("entityId");
    }
  });
  it("loads a repeatable dashboard snapshot with exact Moscow periods", async () => {
    const now = new Date("2026-01-31T21:30:00.000Z");
    const calls: string[] = [];
    const { database, tx } = createDatabase({ calls });

    const model = await getAdminDashboardReadModel(now, {
      database,
      evaluateReadiness: () => {
        calls.push("readiness");
        return { ok: false as const, issues: ["ADMIN_AUTH"] };
      },
    });

    expect(calls).toEqual(["readiness", "transaction"]);
    expect(database.$transaction).toHaveBeenCalledOnce();
    expect(database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead" },
    );
    expect(tx.contactRequest.count).toHaveBeenNthCalledWith(1, {
      where: { status: "NEW" },
    });
    expect(tx.contactRequest.count).toHaveBeenNthCalledWith(2, {
      where: { status: { in: ["NEW", "IN_PROGRESS"] } },
    });
    expect(tx.contactRequest.count).toHaveBeenNthCalledWith(3, {
      where: {
        status: "NEW",
        createdAt: { lt: new Date("2026-01-29T21:30:00.000Z") },
      },
    });
    expect(tx.project.count).toHaveBeenNthCalledWith(1, {
      where: { status: "PUBLISHED" },
    });
    expect(tx.project.count).toHaveBeenNthCalledWith(2, {
      where: { status: "DRAFT" },
    });
    expect(tx.newsPost.count).toHaveBeenCalledWith({
      where: { status: "DRAFT" },
    });
    expect(tx.document.count).toHaveBeenCalledWith({
      where: { status: "DRAFT" },
    });
    expect(tx.donation.count).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date("2026-01-31T20:30:00.000Z") },
      },
    });
    expect(tx.donation.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        status: "SUCCEEDED",
        paidAt: {
          gte: new Date("2026-01-31T21:00:00.000Z"),
          lt: new Date("2026-02-01T21:00:00.000Z"),
        },
      },
      _count: true,
      _sum: { amountKopecks: true },
    });
    expect(tx.donation.aggregate).toHaveBeenNthCalledWith(2, {
      where: {
        status: "SUCCEEDED",
        paidAt: {
          gte: new Date("2026-01-31T21:00:00.000Z"),
          lt: new Date("2026-02-28T21:00:00.000Z"),
        },
      },
      _count: true,
      _sum: { amountKopecks: true },
    });
    expect(tx.adminAuditEvent.findMany).toHaveBeenCalledWith({
      take: 10,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        previousStatus: true,
        nextStatus: true,
        createdAt: true,
      },
    });
    expect(model).toEqual({
      messages: { newCount: 7, activeCount: 5 },
      content: { publishedProjectCount: 11, draftCount: 12 },
      draftCounts: { projects: 3, news: 4, documents: 5 },
      donationLinks: {
        today: "/admin/donations?status=SUCCEEDED&dateField=paidAt&from=2026-02-01&to=2026-02-01",
        month: "/admin/donations?status=SUCCEEDED&dateField=paidAt&from=2026-02-01&to=2026-02-28",
      },
      donations: {
        today: { count: 4, amountKopecks: 125_500 },
        month: { count: 18, amountKopecks: 990_000 },
      },
      alerts: [
        {
          code: "ADMIN_CONFIGURATION",
          severity: "warning",
          message: "Обнаружена проблема конфигурации административной части.",
          href: "/api/ready",
        },
        {
          code: "STALE_PENDING_DONATIONS",
          severity: "warning",
          message: "Ожидающих пожертвований старше часа: 3.",
          href: "/admin/donations?status=PENDING&stale=1",
        },
        {
          code: "STALE_NEW_CONTACTS",
          severity: "warning",
          message: "Новых обращений старше 48 часов: 2.",
          href: "/admin/messages?status=NEW&before=2026-01-29T21%3A30%3A00.000Z",
        },
      ],
      recentActivity: [
        {
          id: "audit-1",
          action: "CONTENT_PUBLISHED",
          entityType: "PROJECT",
          previousStatus: "DRAFT",
          nextStatus: "PUBLISHED",
          createdAt: new Date("2026-01-31T22:00:00.000Z"),
        },
      ],
    });
  });

  it("normalizes nullable donation sums to zero", async () => {
    const { database } = createDatabase({
      contactCounts: [0, 0, 0],
      projectCounts: [0, 0],
      newsPostCount: 0,
      documentCount: 0,
      donationCount: 0,
      donationAggregates: [
        { _count: 0, _sum: { amountKopecks: null } },
        { _count: 0, _sum: { amountKopecks: null } },
      ],
    });

    const model = await getAdminDashboardReadModel(
      new Date("2026-06-15T09:00:00.000Z"),
      {
        database,
        evaluateReadiness: () => ({ ok: true as const, issues: [] }),
      },
    );

    expect(model.donations).toEqual({
      today: { count: 0, amountKopecks: 0 },
      month: { count: 0, amountKopecks: 0 },
    });
    expect(model.alerts).toEqual([]);
  });

  it("propagates unexpected readiness failures before opening a transaction", async () => {
    const { database } = createDatabase();
    const failure = new Error("unexpected readiness failure");

    await expect(
      getAdminDashboardReadModel(new Date(), {
        database,
        evaluateReadiness: () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
