import Link from "next/link";

import { getAdminNotifications } from "@/features/admin-dashboard/notifications";
import { formatDonationDateTime } from "@/features/admin-donations/format";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdminSession();
  const { alerts, reconciliation } = await getAdminNotifications();

  return (
    <section className={styles.dashboard} aria-labelledby="notifications-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Требует внимания</span>
          <h1 id="notifications-title">Уведомления</h1>
        </div>
      </div>
      <div className={styles.dashboardSection}>
        {reconciliation?.enabled ? (
          <p>
            Последняя автоматическая сверка: {reconciliation.completedAt
              ? <time dateTime={reconciliation.completedAt.toISOString()}>{formatDonationDateTime(reconciliation.completedAt)} МСК</time>
              : "нет данных"}.
            {reconciliation.failed !== null ? ` Ошибок в последнем запуске: ${reconciliation.failed}.` : ""}
          </p>
        ) : null}
        {alerts.length ? (
          <ul className={styles.dashboardAlerts} aria-label="Требует внимания">
            {alerts.map((alert) => (
              <li key={alert.code}>
                <Link href={alert.href} prefetch={false}>
                  {alert.message}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.dashboardEmpty}>Новых уведомлений нет.</p>
        )}
      </div>
    </section>
  );
}
