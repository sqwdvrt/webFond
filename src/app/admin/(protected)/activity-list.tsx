import Link from "next/link";
import { formatDonationDateTime } from "@/features/admin-donations/format";
import type { SafeAdminAuditEvent } from "@/features/admin-dashboard/read-model";
import { CONTACT_STATUS_LABELS } from "@/features/admin-messages/presentation";
import { CONTACT_STATUSES, type ContactStatusValue } from "@/features/admin-messages/types";
import styles from "../admin.module.css";

const contentActivityLabels = {
  PROJECT: {
    CONTENT_UPDATED: "Проект обновлён",
    CONTENT_CREATED: "Проект создан",
    CONTENT_PUBLISHED: "Проект опубликован",
    CONTENT_ARCHIVED: "Проект архивирован",
    CONTENT_STATUS_CHANGED: "Статус проекта изменён",
    CONTENT_DELETED: "Проект удалён",
  },
  NEWS_POST: {
    CONTENT_UPDATED: "Новость обновлена",
    CONTENT_CREATED: "Новость создана",
    CONTENT_PUBLISHED: "Новость опубликована",
    CONTENT_ARCHIVED: "Новость архивирована",
    CONTENT_STATUS_CHANGED: "Статус новости изменён",
    CONTENT_DELETED: "Новость удалена",
  },
  DOCUMENT: {
    CONTENT_UPDATED: "Документ обновлён",
    CONTENT_CREATED: "Документ создан",
    CONTENT_PUBLISHED: "Документ опубликован",
    CONTENT_ARCHIVED: "Документ архивирован",
    CONTENT_STATUS_CHANGED: "Статус документа изменён",
    CONTENT_DELETED: "Документ удалён",
  },
} as const;

type ContentActivityAction = keyof typeof contentActivityLabels.PROJECT;

const publicationStatusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
};

const activityEntityLabels: Record<SafeAdminAuditEvent["entityType"], string> = {
  PROJECT: "Проект",
  NEWS_POST: "Новость",
  DOCUMENT: "Документ",
  CONTACT_REQUEST: "Обращение",
  REQUISITES: "Реквизиты",
  DONATION: "Пожертвование",
};

function isContactStatus(value: string): value is ContactStatusValue {
  return (CONTACT_STATUSES as readonly string[]).includes(value);
}

function isContentActivityAction(
  action: SafeAdminAuditEvent["action"],
): action is ContentActivityAction {
  return action in contentActivityLabels.PROJECT;
}

function activityLabel(event: SafeAdminAuditEvent) {
  if (event.action === "REQUISITES_CHANGED" && event.entityType === "REQUISITES") return "Реквизиты изменены";
  if (event.action === "PAYMENT_RECONCILE_REQUESTED" && event.entityType === "DONATION") return "Запрошена проверка платежа в ЮKassa";
  if (event.entityType === "CONTACT_REQUEST") {
    if (event.action === "CONTACT_FOLDER_CHANGED") {
      return event.nextStatus === "ARCHIVE" ? "Обращение перемещено в архив"
        : event.nextStatus === "TRASH" ? "Обращение перемещено в корзину"
        : "Обращение возвращено во входящие";
    }
    if (event.action === "CONTACT_NOTE_CHANGED") {
      return "Изменена внутренняя заметка обращения";
    }

    if (event.action === "CONTACT_STATUS_CHANGED") {
      const previous = event.previousStatus && isContactStatus(event.previousStatus)
        ? CONTACT_STATUS_LABELS[event.previousStatus]
        : undefined;
      const next = event.nextStatus && isContactStatus(event.nextStatus)
        ? CONTACT_STATUS_LABELS[event.nextStatus]
        : undefined;
      return previous && next
        ? `Статус обращения изменён: ${previous} → ${next}`
        : "Статус обращения изменён";
    }

    return "Выполнено административное действие";
  }

  if (!isContentActivityAction(event.action) || !(event.entityType in contentActivityLabels)) {
    return "Выполнено административное действие";
  }

  const label = contentActivityLabels[event.entityType as keyof typeof contentActivityLabels][event.action];

  if (
    event.action === "CONTENT_STATUS_CHANGED" &&
    event.previousStatus &&
    event.nextStatus
  ) {
    const previous = publicationStatusLabels[event.previousStatus];
    const next = publicationStatusLabels[event.nextStatus];
    if (previous && next) return `${label}: ${previous} → ${next}`;
  }

  return label;
}

export function ActivityList({ events }: { events: Array<SafeAdminAuditEvent & { reference?: string }> }) {
  return <>
          {events.length ? (
            <ol className={styles.dashboardActivity}>
              {events.map((event) => (
                <li key={event.id}>
                  <span className={styles.dashboardActivityEntity}>
                    {activityEntityLabels[event.entityType]}
                  </span>
                  <strong>{activityLabel(event)}</strong>
                  {event.reference ? <span className={styles.dashboardActivityEntity}>ID: {event.reference}</span> : null}
                  {event.href ? <Link href={event.href} prefetch={false}>Открыть объект</Link> : event.href === null ? <span>Объект недоступен</span> : null}
                  <time dateTime={event.createdAt.toISOString()}>
                    {formatDonationDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.dashboardEmpty}>Действий пока нет.</p>
          )}
  </>;
}
