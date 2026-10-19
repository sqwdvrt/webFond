import type { AdminAuditEvent } from "@prisma/client";

import { moscowDayInterval, moscowMonthInterval } from "@/lib/dates/moscow";
import { prisma } from "@/lib/db";
import { evaluateReadiness } from "@/features/readiness/evaluate";
import { readPaymentsAvailability } from "@/features/payments/config";

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
  | "previousStatus"
  | "nextStatus"
  | "createdAt"
> & { href?: string | null };

export type AdminDashboardReadModel = {
  messages: { newCount: number; activeCount: number };
  content: { publishedProjectCount: number; draftCount: number };
  donations: {
    today: { count: number; amountKopecks: number };
    month: { count: number; amountKopecks: number };
  };
  alerts: OperationalAlert[];
  recentActivity: SafeAdminAuditEvent[];
  draftCounts?: { projects: number; news: number; documents: number };
  donationLinks?: { today: string; month: string };
  reconciliation?: { enabled: boolean; completedAt: Date | null; failed: number | null };
};

type CountDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<{ id: string }[]>;
};

type DonationAggregate = {
  _count: number;
  _sum: { amountKopecks: number | null };
};

type DashboardTransaction = {
  contactRequest: CountDelegate;
  project: CountDelegate;
  newsPost: CountDelegate;
  document: CountDelegate;
  donation: CountDelegate & {
    aggregate: (args: unknown) => Promise<DonationAggregate>;
  };
  adminAuditEvent: {
    findMany: (args: unknown) => Promise<(SafeAdminAuditEvent & { entityId: string })[]>;
  };
  siteSetting: {
    findMany: (args: unknown) => Promise<{ key: string }[]>;
    findUnique: (args: unknown) => Promise<{ value: unknown } | null>;
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
  paymentsEnabled?: () => boolean;
};

const defaultDependencies: DashboardDependencies = {
  database: prisma as unknown as DashboardDatabase,
  evaluateReadiness,
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

export async function getAdminDashboardReadModel(
  now = new Date(),
  dependencies: DashboardDependencies = defaultDependencies,
): Promise<AdminDashboardReadModel> {
  const readiness = dependencies.evaluateReadiness();
  const day = moscowDayInterval(now);
  const month = moscowMonthInterval(now);
  const paymentsEnabled = (dependencies.paymentsEnabled ?? (() => readPaymentsAvailability().enabled))();

  const snapshot = await dependencies.database.$transaction(async (tx) => {
    const [
      newContactCount,
      activeContactCount,
      staleNewContactCount,
      publishedProjectCount,
      draftProjectCount,
      draftNewsPostCount,
      draftDocumentCount,
      stalePendingDonationCount,
      today,
      currentMonth,
      recentActivity,
    ] = await Promise.all([
      tx.contactRequest.count({ where: { status: "NEW" } }),
      tx.contactRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
      tx.contactRequest.count({
        where: {
          status: "NEW",
          createdAt: { lt: staleContactCutoff(now) },
        },
      }),
      tx.project.count({ where: { status: "PUBLISHED" } }),
      tx.project.count({ where: { status: "DRAFT" } }),
      tx.newsPost.count({ where: { status: "DRAFT" } }),
      tx.document.count({ where: { status: "DRAFT" } }),
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
      }),
    ]);

    const heartbeat = paymentsEnabled ? await tx.siteSetting.findUnique({ where: { key: "paymentsReconciliationHeartbeat" }, select: { value: true } }) : null;
    const reconciliation = paymentsEnabled ? parseReconciliationHeartbeat(heartbeat?.value, now) : undefined;
    const activity = await Promise.all(recentActivity.map(async ({ entityId, ...event }) => {
      if (!entityId) return event;
      let href: string | null = null;
      if (event.entityType === "REQUISITES") {
        const rows = await tx.siteSetting.findMany({ where: { key: "requisites" }, select: { key: true } });
        if (rows.length) href = "/admin/requisites";
      } else {
        const targets = {
          PROJECT: [tx.project, "/admin/projects"], NEWS_POST: [tx.newsPost, "/admin/news"],
          DOCUMENT: [tx.document, "/admin/documents"], CONTACT_REQUEST: [tx.contactRequest, "/admin/messages"],
          DONATION: [tx.donation, "/admin/donations"],
        } as const;
        const target = targets[event.entityType];
        if (target) {
          const rows = await target[0].findMany({ where: { id: entityId }, select: { id: true }, take: 1 });
          if (rows.length) href = event.entityType === "DONATION"
            ? `${target[1]}?donationId=${encodeURIComponent(entityId)}`
            : `${target[1]}/${encodeURIComponent(entityId)}`;
        }
      }
      return { ...event, href };
    }));
    return {
      newContactCount,
      activeContactCount,
      staleNewContactCount,
      publishedProjectCount,
      draftProjectCount,
      draftNewsPostCount,
      draftDocumentCount,
      stalePendingDonationCount,
      today,
      currentMonth,
      recentActivity: activity,
      reconciliation,
    };
  }, { isolationLevel: "RepeatableRead" });

  return {
    ...(snapshot.reconciliation ? { reconciliation: snapshot.reconciliation } : {}),
    draftCounts: { projects: snapshot.draftProjectCount, news: snapshot.draftNewsPostCount, documents: snapshot.draftDocumentCount },
    donationLinks: {
      today: donationPeriodHref(day.start, day.end),
      month: donationPeriodHref(month.start, month.end),
    },
    messages: {
      newCount: snapshot.newContactCount,
      activeCount: snapshot.activeContactCount,
    },
    content: {
      publishedProjectCount: snapshot.publishedProjectCount,
      draftCount:
        snapshot.draftProjectCount
        + snapshot.draftNewsPostCount
        + snapshot.draftDocumentCount,
    },
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
      now,
      reconciliation: snapshot.reconciliation,
      staleNewContactCount: snapshot.staleNewContactCount,
      stalePendingDonationCount: snapshot.stalePendingDonationCount,
      readinessIssues: readiness.issues,
    }),
    recentActivity: snapshot.recentActivity,
  };
}

function parseReconciliationHeartbeat(value: unknown, now: Date) {
  const invalid = { enabled: true, completedAt: null, failed: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const { completedAt, failed } = value as Record<string, unknown>;
  if (typeof completedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(completedAt)) return invalid;
  const completion = new Date(completedAt);
  if (!Number.isFinite(completion.getTime()) || completion.toISOString() !== completedAt || completion > now || typeof failed !== "number" || !Number.isSafeInteger(failed) || failed < 0) return invalid;
  return { enabled: true, completedAt: completion, failed };
}

function donationPeriodHref(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
  const query = new URLSearchParams({ status: "SUCCEEDED", dateField: "paidAt", from: formatter.format(start), to: formatter.format(new Date(end.getTime() - 1)) });
  return `/admin/donations?${query}`;
}
