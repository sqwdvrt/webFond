import {
  ArrowRight,
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  Mail,
  Newspaper,
} from "lucide-react";
import Link from "next/link";

import { formatDonationAmount, formatDonationDateTime } from "@/features/admin-donations/format";
import {
  getAdminDashboardReadModel,
  type AdminDashboardReadModel,
} from "@/features/admin-dashboard/read-model";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { ActivityList } from "./activity-list";

import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const overviewSections = [
  {
    href: "/admin/messages",
    label: "Письма",
    description: "Сообщения с контактной формы",
    icon: Mail,
  },
  {
    href: "/admin/projects",
    label: "Проекты",
    description: "Публикация и обновление программ фонда",
    icon: FolderKanban,
  },
  {
    href: "/admin/news",
    label: "Новости",
    description: "Материалы и события фонда",
    icon: Newspaper,
  },
  {
    href: "/admin/documents",
    label: "Документы",
    description: "Отчеты и публичные документы",
    icon: FileText,
  },
  {
    href: "/admin/requisites",
    label: "Реквизиты",
    description: "Юридические и банковские данные",
    icon: Landmark,
  },
  {
    href: "/admin/donations",
    label: "Пожертвования",
    description: "Список, фильтры и CSV-экспорт",
    icon: HandCoins,
  },
] as const;

function Dashboard({ model }: { model: AdminDashboardReadModel }) {
  return (
    <section className={styles.dashboard} aria-labelledby="admin-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Рабочая область</span>
          <h1 id="admin-title">Обзор</h1>
        </div>
      </div>

      <section className={styles.dashboardSection} aria-labelledby="metrics-title">
        <h2 id="metrics-title">Ключевые показатели</h2>
        <dl className={styles.dashboardMetrics}>
          <div className={styles.dashboardMetric}>
            <dt>Новые обращения</dt>
            <dd><Link href="/admin/messages?status=NEW" prefetch={false} aria-label={`Новые обращения: ${model.messages.newCount}`}><strong>{model.messages.newCount}</strong></Link></dd>
          </div>
          <div className={styles.dashboardMetric}>
            <dt>Активные обращения</dt>
            <dd><Link href="/admin/messages?status=ACTIVE" prefetch={false} aria-label={`Активные обращения: ${model.messages.activeCount}`}><strong>{model.messages.activeCount}</strong></Link></dd>
          </div>
          <div className={styles.dashboardMetric}>
            <dt>Успешные пожертвования сегодня</dt>
            <dd>
              <Link href={model.donationLinks?.today ?? "/admin/donations?status=SUCCEEDED"} prefetch={false}>
              <span>{model.donations.today.count} успешных</span>
              <strong>
                {formatDonationAmount(model.donations.today.amountKopecks, "RUB")}
              </strong>
              </Link>
            </dd>
          </div>
          <div className={styles.dashboardMetric}>
            <dt>Успешные пожертвования за месяц</dt>
            <dd>
              <Link href={model.donationLinks?.month ?? "/admin/donations?status=SUCCEEDED"} prefetch={false}>
              <span>{model.donations.month.count} успешных</span>
              <strong>
                {formatDonationAmount(model.donations.month.amountKopecks, "RUB")}
              </strong>
              </Link>
            </dd>
          </div>
          <div className={styles.dashboardMetric}>
            <dt>Опубликованные проекты</dt>
            <dd><Link href="/admin/projects?status=PUBLISHED" prefetch={false} aria-label={`Опубликованные проекты: ${model.content.publishedProjectCount}`}><strong>{model.content.publishedProjectCount}</strong></Link></dd>
          </div>
          <div className={styles.dashboardMetric}>
            <dt>Черновики</dt>
            <dd><strong>{model.content.draftCount}</strong>
              {model.draftCounts ? <span>
                <Link href="/admin/projects?status=DRAFT" prefetch={false}>Проекты: {model.draftCounts.projects}</Link>{" · "}
                <Link href="/admin/news?status=DRAFT" prefetch={false}>Новости: {model.draftCounts.news}</Link>{" · "}
                <Link href="/admin/documents?status=DRAFT" prefetch={false}>Документы: {model.draftCounts.documents}</Link>
              </span> : null}
            </dd>
          </div>
        </dl>
      </section>

      <div className={styles.dashboardColumns}>
        <section className={styles.dashboardSection} aria-labelledby="alerts-title">
          <h2 id="alerts-title">Предупреждения</h2>
          {model.reconciliation?.enabled ? <p>
            Последняя автоматическая сверка: {model.reconciliation.completedAt
              ? <time dateTime={model.reconciliation.completedAt.toISOString()}>{formatDonationDateTime(model.reconciliation.completedAt)} МСК</time>
              : "нет данных"}.
            {model.reconciliation.failed !== null ? ` Ошибок в последнем запуске: ${model.reconciliation.failed}.` : ""}
          </p> : null}
          {model.alerts.length ? (
            <ul className={styles.dashboardAlerts} aria-label="Требует внимания">
              {model.alerts.map((alert) => (
                <li key={alert.code}>
                  <Link href={alert.href} prefetch={false}>
                    {alert.message}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.dashboardEmpty}>
              Требующих внимания предупреждений нет.
            </p>
          )}
        </section>

        <section className={styles.dashboardSection} aria-labelledby="activity-title">
          <h2 id="activity-title">Последние действия</h2>
          <p>Доступ к админке общий; персональный автор действий не определяется.</p>
          <ActivityList events={model.recentActivity.slice(0, 5)} />
          <p className={styles.dashboardNote}><Link href="/admin/changes">Все изменения</Link></p>
        </section>
      </div>

      <nav
        className={styles.overviewNavigation}
        aria-label="Управление разделами"
      >
        {overviewSections.map(({ description, href, icon: Icon, label }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden="true" size={20} />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ))}
      </nav>
    </section>
  );
}

type AdminDashboardDependencies = {
  requireSession: () => Promise<unknown>;
  loadDashboard: () => Promise<AdminDashboardReadModel>;
};

const defaultDependencies: AdminDashboardDependencies = {
  requireSession: requireAdminSession,
  loadDashboard: getAdminDashboardReadModel,
};

export async function renderAdminDashboard(
  dependencies: AdminDashboardDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const model = await dependencies.loadDashboard();
  return <Dashboard model={model} />;
}

export default async function AdminPage() {
  return renderAdminDashboard();
}
