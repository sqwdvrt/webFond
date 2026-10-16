import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminContactRequest } from "@/features/admin-messages/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../../admin.module.css";
import { updateContactRequestAction } from "../actions";
import { MessageForm } from "../message-form";
import { contactEmailHref } from "../messages-view";

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
};

const defaultDependencies: MessageDetailPageDependencies = {
  requireSession: requireAdminSession,
  getContact: getAdminContactRequest,
  updateAction: updateContactRequestAction,
  showNotFound: notFound,
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

  const action = dependencies.updateAction.bind(null, contact.id);
  const successMessage = query.success === "saved" ? "Обращение сохранено" : undefined;

  return (
    <section className={styles.messagesPage} aria-labelledby="message-title">
      <div className={styles.messageHeading}>
        <div>
          <Link className={styles.backLink} href="/admin/messages">
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
        <div className={styles.messageDetailBody}>
          <h2>Текст обращения</h2>
          <p>{contact.message}</p>
        </div>
      </article>

      <MessageForm action={action} contact={contact} successMessage={successMessage} />
    </section>
  );
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
