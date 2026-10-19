import type { ReadinessIssueCode } from "@/features/readiness/evaluate";

const CONTACT_STALE_AFTER_MS = 48 * 60 * 60 * 1_000;
const DONATION_STALE_AFTER_MS = 60 * 60 * 1_000;

export type OperationalAlertCode =
  | "STALE_NEW_CONTACTS"
  | "STALE_PENDING_DONATIONS"
  | "PAYMENTS_RECONCILIATION_STALE"
  | "ADMIN_CONFIGURATION";

export type OperationalAlert = {
  code: OperationalAlertCode;
  severity: "warning";
  message: string;
  href: string;
};

type OperationalAlertInput = {
  now?: Date;
  reconciliation?: { enabled: boolean; completedAt: Date | null; failed: number | null };
  staleNewContactCount: number;
  stalePendingDonationCount: number;
  readinessIssues: ReadinessIssueCode[];
};

export function staleContactCutoff(now: Date) {
  return new Date(now.getTime() - CONTACT_STALE_AFTER_MS);
}

export function staleDonationCutoff(now: Date) {
  return new Date(now.getTime() - DONATION_STALE_AFTER_MS);
}

function normalizeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function buildOperationalAlerts({
  staleNewContactCount,
  stalePendingDonationCount,
  readinessIssues,
  now = new Date(),
  reconciliation,
}: OperationalAlertInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const contacts = normalizeCount(staleNewContactCount);
  const donations = normalizeCount(stalePendingDonationCount);

  if (readinessIssues.includes("ADMIN_AUTH")) {
    alerts.push({
      code: "ADMIN_CONFIGURATION",
      severity: "warning",
      message: "Обнаружена проблема конфигурации административной части.",
      href: "/api/ready",
    });
  }

  if (donations > 0) {
    alerts.push({
      code: "STALE_PENDING_DONATIONS",
      severity: "warning",
      message: `Ожидающих пожертвований старше часа: ${donations}.`,
      href: "/admin/donations?status=PENDING&stale=1",
    });
  }

  if (reconciliation?.enabled) {
    if (!reconciliation.completedAt || now.getTime() - reconciliation.completedAt.getTime() > 15 * 60 * 1_000) {
      alerts.push({ code: "PAYMENTS_RECONCILIATION_STALE", severity: "warning", message: "Нет подтверждения завершения автоматической сверки платежей за последние 15 минут. Проверьте планировщик.", href: "/admin/donations?status=PENDING" });
    }
  }

  if (contacts > 0) {
    alerts.push({
      code: "STALE_NEW_CONTACTS",
      severity: "warning",
      message: `Новых обращений старше 48 часов: ${contacts}.`,
      href: `/admin/messages?status=NEW&before=${encodeURIComponent(staleContactCutoff(now).toISOString())}`,
    });
  }

  return alerts;
}
