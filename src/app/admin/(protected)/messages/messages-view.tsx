import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";

import { buildContactQuery } from "@/features/admin-messages/filters";
import type { ContactPageResult } from "@/features/admin-messages/repository";
import {
  CONTACT_STATUSES,
  type ContactPageFilters,
  type ContactStatusValue,
} from "@/features/admin-messages/types";

import styles from "../../admin.module.css";

const STATUS_LABELS: Record<ContactStatusValue, string> = {
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыто",
  SPAM: "Спам",
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function messagesHref(filters: ContactPageFilters, page: number) {
  const query = buildContactQuery({ ...filters, page });
  return `/admin/messages${query.size ? `?${query}` : ""}`;
}

function excerpt(value: string) {
  const characters = Array.from(value);
  return characters.length > 180
    ? `${characters.slice(0, 180).join("")}…`
    : value;
}

export function InvalidMessageFilters() {
  return (
    <section className={styles.messagesPage}>
      <div className={styles.messageHeading}>
        <div>
          <span className={styles.eyebrow}>Административная часть</span>
          <h1>Некорректные фильтры</h1>
        </div>
      </div>
      <div className={styles.emptyState}>
        <p>Проверьте статус, даты, строку поиска и номер страницы.</p>
        <Link className={styles.primaryLink} href="/admin/messages">
          Сбросить фильтры
        </Link>
      </div>
    </section>
  );
}

export function MessagesView({
  filters,
  result,
}: {
  filters: ContactPageFilters;
  result: ContactPageResult;
}) {
  return (
    <section className={styles.messagesPage} aria-labelledby="messages-title">
      <div className={styles.messageHeading}>
        <div>
          <Link className={styles.backLink} href="/admin">
            <ChevronLeft aria-hidden="true" size={16} />
            Административная часть
          </Link>
          <h1 id="messages-title">Обращения</h1>
        </div>
      </div>

      <form
        className={`${styles.filters} ${styles.messageFilters}`}
        method="get"
        role="search"
      >
        <label className={styles.compactField}>
          <span>Статус</span>
          <select defaultValue={filters.status ?? ""} name="status">
            <option value="">Все статусы</option>
            {CONTACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.compactField}>
          <span>Дата от</span>
          <input defaultValue={filters.from ?? ""} name="from" type="date" />
        </label>
        <label className={styles.compactField}>
          <span>Дата до</span>
          <input defaultValue={filters.to ?? ""} name="to" type="date" />
        </label>
        <label className={`${styles.compactField} ${styles.searchField}`}>
          <span>Поиск</span>
          <input
            defaultValue={filters.q ?? ""}
            maxLength={120}
            name="q"
            placeholder="Имя, email или текст обращения"
            type="search"
          />
        </label>
        <div className={styles.filterActions}>
          <button className={styles.primaryButton} type="submit">
            <Search aria-hidden="true" size={18} />
            Применить
          </button>
          <Link className={styles.clearButton} href="/admin/messages">
            <X aria-hidden="true" size={18} />
            Очистить
          </Link>
        </div>
      </form>

      <div className={styles.listSummary} aria-live="polite">
        <span>Найдено: {result.total}</span>
        <span>По {result.pageSize} на странице</span>
        <span>Страница {result.page} из {result.totalPages}</span>
      </div>

      {result.rows.length ? (
        <div className={styles.messageQueue}>
          {result.rows.map((contact) => (
            <article className={styles.messageQueueCard} key={contact.id}>
              <header className={styles.messageQueueHeader}>
                <strong>{contact.name}</strong>
                <span className={`${styles.status} ${styles[`status${contact.status}`]}`}>
                  {STATUS_LABELS[contact.status]}
                </span>
              </header>
              <div className={styles.messageQueueMeta}>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                <time dateTime={contact.createdAt.toISOString()}>
                  {dateTimeFormatter.format(contact.createdAt)} МСК
                </time>
              </div>
              <p className={styles.messageQueueExcerpt}>{excerpt(contact.message)}</p>
              <Link
                className={styles.messageQueueLink}
                href={`/admin/messages/${contact.id}`}
                prefetch={false}
              >
                Открыть обращение {contact.name}
                <ChevronRight aria-hidden="true" size={18} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h2>Обращения не найдены</h2>
          <p>Измените фильтры или очистите их, чтобы увидеть другие записи.</p>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Страницы обращений">
          {result.page > 1 ? (
            <Link href={messagesHref(filters, result.page - 1)}>
              <ChevronLeft aria-hidden="true" size={18} />
              Назад
            </Link>
          ) : (
            <span />
          )}
          {result.page < result.totalPages ? (
            <Link href={messagesHref(filters, result.page + 1)}>
              Далее
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
