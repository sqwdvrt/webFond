import { cache } from "react";

import { prisma } from "@/lib/db";
import { evaluateReadiness } from "@/features/readiness/evaluate";
import { readPaymentsAvailability } from "@/features/payments/config";

import {
  buildOperationalAlerts,
  parseReconciliationHeartbeat,
  staleContactCutoff,
  staleDonationCutoff,
} from "./alerts";

// Only the data needed for active notifications is loaded on other admin pages.
type NotificationsTransaction = {
  contactRequest: { count: (args: unknown) => Promise<number> };
  donation: { count: (args: unknown) => Promise<number> };
  siteSetting: { findUnique: (args: unknown) => Promise<{ value: unknown } | null> };
};

type NotificationsDependencies = {
  database: {
    $transaction: <Result>(
      callback: (tx: NotificationsTransaction) => Promise<Result>,
      options: { isolationLevel: "RepeatableRead" },
    ) => Promise<Result>;
  };
  evaluateReadiness: () => Pick<ReturnType<typeof evaluateReadiness>, "issues">;
  paymentsEnabled: () => boolean;
};

const defaultDependencies: NotificationsDependencies = {
  database: prisma as unknown as NotificationsDependencies["database"],
  evaluateReadiness,
  paymentsEnabled: () => readPaymentsAvailability().enabled,
};

export async function loadAdminNotifications(
  now = new Date(),
  dependencies: NotificationsDependencies = defaultDependencies,
) {
  const readiness = dependencies.evaluateReadiness();
  const paymentsEnabled = dependencies.paymentsEnabled();
  const snapshot = await dependencies.database.$transaction(async (tx) => {
    const [staleNewContactCount, stalePendingDonationCount, heartbeat] = await Promise.all([
      tx.contactRequest.count({ where: { status: "NEW", folder: "INBOX", createdAt: { lt: staleContactCutoff(now) } } }),
      tx.donation.count({ where: { status: "PENDING", createdAt: { lt: staleDonationCutoff(now) } } }),
      paymentsEnabled
        ? tx.siteSetting.findUnique({ where: { key: "paymentsReconciliationHeartbeat" }, select: { value: true } })
        : null,
    ]);
    return {
      staleNewContactCount,
      stalePendingDonationCount,
      reconciliation: paymentsEnabled ? parseReconciliationHeartbeat(heartbeat?.value, now) : undefined,
    };
  }, { isolationLevel: "RepeatableRead" });

  return {
    alerts: buildOperationalAlerts({ ...snapshot, now, readinessIssues: readiness.issues }),
    reconciliation: snapshot.reconciliation,
  };
}

// Share one snapshot between the server layout and page within each request.
export const getAdminNotifications = cache(() => loadAdminNotifications());
