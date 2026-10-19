import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  contactEmailHref,
  contactReplyHref,
} from "@/features/admin-messages/presentation";
import { getAdminContactRequest, getContactHistory } from "@/features/admin-messages/repository";
import { safeMessagesReturnTo } from "@/features/admin-messages/filters";
import { CONTACT_STATUS_LABELS } from "@/features/admin-messages/presentation";
import { CONTACT_STATUSES, CONTACT_FOLDERS, CONTACT_FOLDER_LABELS, type ContactFolderValue, type ContactStatusValue } from "@/features/admin-messages/types";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../../admin.module.css";
import { updateContactRequestAction, updateContactRequestWithReturnAction } from "../actions";
import { ContactStatusBadge } from "../contact-status-badge";
import { MessageForm } from "../message-form";
import { QuickStatusForm } from "../quick-status-form";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

type MessageDetailPageDependencies = {
  requireSession: () => Promise<unknown>;
  getContact: typeof getAdminContactRequest;
  updateAction: typeof updateContactRequestAction;
  showNotFound: () => never;
  getHistory: typeof getContactHistory;
  updateWithReturnAction: typeof updateContactRequestWithReturnAction;
};

const defaultDependencies: MessageDetailPageDependencies = {
  requireSession: requireAdminSession,
  getContact: getAdminContactRequest,
  updateAction: updateContactRequestAction,
  showNotFound: notFound,
  getHistory: getContactHistory,
  updateWithReturnAction: updateContactRequestWithReturnAction,
};

export async function renderMessageDetailPage(
  params: Promise<{ id: string }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  dependencies: MessageDetailPageDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const contact = await dependencies.getContact(id);
  if (!contact) return dependencies.showNotFound();

  const history = await dependencies.getHistory(contact.id);
  const returnTo = safeMessagesReturnTo(query.returnTo);
  const action = query.returnTo
    ? dependencies.updateWithReturnAction.bind(null, contact.id, returnTo)
    : dependencies.updateAction.bind(null, contact.id);
  const successMessage = query.success === "saved" ? "Обращение сохранено" : undefined;

  return (
    <section className={styles.messagesPage} aria-labelledby="message-title">
      <div className={styles.messageHeading}>
        <div>
          <Link className={styles.backLink} href={returnTo}>
            <ChevronLeft aria-hidden="true" size={16} />
            Все обращения
          </Link>
          <h1 id="message-title">Обращение от {contact.name}</h1>
        </div>
      </div>

      <article className={styles.messageDetail}>
        <dl className={styles.messageDetailMeta}>
          <div>
            <dt>Имя</dt>
            <dd>{contact.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd><a href={contactEmailHref(contact.email)}>{contact.email}</a></dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd><ContactStatusBadge status={contact.status} /></dd>
          </div>
          <div>
            <dt>Получено</dt>
            <dd>
              <time dateTime={contact.createdAt.toISOString()}>
                {dateTimeFormatter.format(contact.createdAt)} МСК
              </time>
            </dd>
          </div>
          <div>
            <dt>Обновлено</dt>
            <dd>
              <time dateTime={contact.updatedAt.toISOString()}>
                {dateTimeFormatter.format(contact.updatedAt)} МСК
              </time>
            </dd>
          </div>
        </dl>
        <div className={styles.messageDetailActions}>
          <a href={contactReplyHref(contact.email)}>Ответить по email</a>
        </div>
        <div className={styles.messageDetailBody}>
          <h2>Текст обращения</h2>
          <p>{contact.message}</p>
        </div>
      </article>

      <MessageForm action={action} contact={contact} successMessage={successMessage} />
      <section aria-labelledby="quick-status-title">
        <h2 id="quick-status-title">Быстрые действия</h2>
        <div className={styles.messageDetailActions}>
          {([ ["IN_PROGRESS", "В работу"], ["CLOSED", "Закрыть"], ["SPAM", "Спам"] ] as const).filter(([status]) => status !== contact.status).map(([status, label]) =>
            <QuickStatusForm key={status} action={action} status={status} label={label} updatedAt={contact.updatedAt.toISOString()} />
          )}
        </div>
      </section>
      <section aria-labelledby="contact-history-title">
        <h2 id="contact-history-title">История обращения</h2>
        <p>Последние 20 изменений. Доступ к админке общий; персональный автор не определяется.</p>
        {history.length ? <ol>{history.map((event) => <li key={event.id}>
          {event.action === "CONTACT_NOTE_CHANGED" ? "Изменена внутренняя заметка" : event.action === "CONTACT_FOLDER_CHANGED" ? `Папка: ${folderLabel(event.previousStatus)} → ${folderLabel(event.nextStatus)}` : `Статус: ${statusLabel(event.previousStatus)} → ${statusLabel(event.nextStatus)}`}
          {" · "}<time dateTime={event.createdAt.toISOString()}>{dateTimeFormatter.format(event.createdAt)} МСК</time>
        </li>)}</ol> : <p>Изменений пока нет.</p>}
      </section>
    </section>
  );
}

function folderLabel(value: string | null) {
  return value && CONTACT_FOLDERS.includes(value as ContactFolderValue) ? CONTACT_FOLDER_LABELS[value as ContactFolderValue] : "Неизвестная папка";
}

function statusLabel(value: string | null) {
  return value && CONTACT_STATUSES.includes(value as ContactStatusValue) ? CONTACT_STATUS_LABELS[value as ContactStatusValue] : "Неизвестный статус";
}

export default async function MessageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderMessageDetailPage(params, searchParams);
}
