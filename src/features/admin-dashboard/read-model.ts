import type { AdminAuditEvent } from "@prisma/client";

import { moscowDayInterval, moscowMonthInterval } from "@/lib/dates/moscow";
import { prisma } from "@/lib/db";
import { evaluateReadiness } from "@/features/readiness/evaluate";

import {
  buildOperationalAlerts,
  staleContactCutoff,
  staleDonationCutoff,
  type OperationalAlert,
} from "./alerts";

export type SafeAdminAuditEvent = Pick<
  AdminAuditEvent,
  | "id"
  | "action"
  | "entityType"
  | "entityId"
  | "previousStatus"
  | "nextStatus"
  | "createdAt"
>;

export type AdminDashboardReadModel = {
  messages: { newCount: number };
  donations: {
    today: { count: number; amountKopecks: number };
    month: { count: number; amountKopecks: number };
  };
  alerts: OperationalAlert[];
  recentActivity: SafeAdminAuditEvent[];
};

type CountDelegate = {
  count: (args: unknown) => Promise<number>;
};

type DonationAggregate = {
  _count: number;
  _sum: { amountKopecks: number | null };
};

type DashboardTransaction = {
  contactRequest: CountDelegate;
  donation: CountDelegate & {
    aggregate: (args: unknown) => Promise<DonationAggregate>;
  };
  adminAuditEvent: {
    findMany: (args: unknown) => Promise<SafeAdminAuditEvent[]>;
  };
};

export type DashboardDatabase = {
  $transaction: <Result>(
    callback: (transaction: DashboardTransaction) => Promise<Result>,
    options: { isolationLevel: "RepeatableRead" },
  ) => Promise<Result>;
};

type DashboardDependencies = {
  database: DashboardDatabase;
  evaluateReadiness: typeof evaluateReadiness;
};

const defaultDependencies: DashboardDependencies = {
  database: prisma as unknown as DashboardDatabase,
  evaluateReadiness,
};

export async function getAdminDashboardReadModel(
  now = new Date(),
  dependencies: DashboardDependencies = defaultDependencies,
): Promise<AdminDashboardReadModel> {
  const readiness = dependencies.evaluateReadiness();
  const day = moscowDayInterval(now);
  const month = moscowMonthInterval(now);

  const snapshot = await dependencies.database.$transaction(async (tx) => {
    const [
      newContactCount,
      staleNewContactCount,
      stalePendingDonationCount,
      today,
      currentMonth,
      recentActivity,
    ] = await Promise.all([
      tx.contactRequest.count({ where: { status: "NEW" } }),
      tx.contactRequest.count({
        where: {
          status: "NEW",
          createdAt: { lt: staleContactCutoff(now) },
        },
      }),
      tx.donation.count({
        where: {
          status: "PENDING",
          createdAt: { lt: staleDonationCutoff(now) },
        },
      }),
      tx.donation.aggregate({
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: day.start, lt: day.end },
        },
        _count: true,
        _sum: { amountKopecks: true },
      }),
      tx.donation.aggregate({
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: month.start, lt: month.end },
        },
        _count: true,
        _sum: { amountKopecks: true },
      }),
      tx.adminAuditEvent.findMany({
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
      }),
    ]);

    return {
      newContactCount,
      staleNewContactCount,
      stalePendingDonationCount,
      today,
      currentMonth,
      recentActivity,
    };
  }, { isolationLevel: "RepeatableRead" });

  return {
    messages: { newCount: snapshot.newContactCount },
    donations: {
      today: {
        count: snapshot.today._count,
        amountKopecks: snapshot.today._sum.amountKopecks ?? 0,
      },
      month: {
        count: snapshot.currentMonth._count,
        amountKopecks: snapshot.currentMonth._sum.amountKopecks ?? 0,
      },
    },
    alerts: buildOperationalAlerts({
      staleNewContactCount: snapshot.staleNewContactCount,
      stalePendingDonationCount: snapshot.stalePendingDonationCount,
      readinessIssues: readiness.issues,
    }),
    recentActivity: snapshot.recentActivity,
  };
}
