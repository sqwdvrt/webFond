import { listContactRequests } from "@/features/contact/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const createdAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

type MessagesPageDependencies = {
  requireSession: () => Promise<unknown>;
  listRequests: typeof listContactRequests;
};

const defaultDependencies: MessagesPageDependencies = {
  requireSession: requireAdminSession,
  listRequests: listContactRequests,
};

export async function renderMessagesPage(
  dependencies: MessagesPageDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const messages = await dependencies.listRequests();

  return (
    <section className={styles.dashboard} aria-labelledby="messages-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Обращения</span>
          <h1 id="messages-title">Письма</h1>
        </div>
      </div>

      <div className={styles.dashboardContent}>
        {messages.length === 0 ? (
          <div className={styles.contentEmptyState} role="status">
            <p>Писем пока нет</p>
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((message) => (
              <article className={styles.messageCard} key={message.id}>
                <header>
                  <strong>{message.name}</strong>
                  <a href={`mailto:${message.email}`}>{message.email}</a>
                  <time dateTime={message.createdAt.toISOString()}>
                    {createdAtFormatter.format(message.createdAt)}
                  </time>
                </header>
                <p>{message.message}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function MessagesPage() {
  return renderMessagesPage();
}
