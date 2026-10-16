import { describe, expect, it, vi } from "vitest";

import {
  getAdminDashboardReadModel,
  type DashboardDatabase,
} from "./read-model";

function createDatabase(overrides: {
  contactCounts?: number[];
  donationCount?: number;
  donationAggregates?: Array<{
    _count: number;
    _sum: { amountKopecks: number | null };
  }>;
  calls?: string[];
} = {}) {
  const tx = {
    contactRequest: {
      count: vi.fn()
        .mockResolvedValueOnce(overrides.contactCounts?.[0] ?? 7)
        .mockResolvedValueOnce(overrides.contactCounts?.[1] ?? 2),
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
      findMany: vi.fn().mockResolvedValue([
        {
          id: "audit-1",
          action: "CONTENT_PUBLISHED",
          entityType: "PROJECT",
          entityId: "project-private-id",
          previousStatus: "DRAFT",
          nextStatus: "PUBLISHED",
          createdAt: new Date("2026-01-31T22:00:00.000Z"),
        },
      ]),
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
      where: {
        status: "NEW",
        createdAt: { lt: new Date("2026-01-29T21:30:00.000Z") },
      },
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
      take: 20,
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
      messages: { newCount: 7 },
      donations: {
        today: { count: 4, amountKopecks: 125_500 },
        month: { count: 18, amountKopecks: 990_000 },
      },
      alerts: [
        {
          code: "STALE_NEW_CONTACTS",
          severity: "warning",
          message: "Новых обращений старше 48 часов: 2.",
        },
        {
          code: "STALE_PENDING_DONATIONS",
          severity: "warning",
          message: "Ожидающих пожертвований старше часа: 3.",
        },
        {
          code: "ADMIN_CONFIGURATION",
          severity: "warning",
          message: "Обнаружена проблема конфигурации административной части.",
        },
      ],
      recentActivity: [
        {
          id: "audit-1",
          action: "CONTENT_PUBLISHED",
          entityType: "PROJECT",
          entityId: "project-private-id",
          previousStatus: "DRAFT",
          nextStatus: "PUBLISHED",
          createdAt: new Date("2026-01-31T22:00:00.000Z"),
        },
      ],
    });
  });

  it("normalizes nullable donation sums to zero", async () => {
    const { database } = createDatabase({
      contactCounts: [0, 0],
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
