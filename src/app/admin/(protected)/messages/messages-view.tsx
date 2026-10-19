import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";

import { buildContactQuery } from "@/features/admin-messages/filters";
import {
  CONTACT_STATUS_LABELS,
  contactEmailHref,
  contactExcerpt,
  paginationItems,
} from "@/features/admin-messages/presentation";
import type { ContactPageResult } from "@/features/admin-messages/repository";
import {
  CONTACT_STATUSES,
  type ContactPageFilters,
} from "@/features/admin-messages/types";

import { ContactStatusBadge } from "./contact-status-badge";
import styles from "../../admin.module.css";

export { contactEmailHref } from "@/features/admin-messages/presentation";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function messagesHref(filters: ContactPageFilters, page: number) {
  const query = buildContactQuery({ ...filters, page });
  return `/admin/messages${query.size ? `?${query}` : ""}`;
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
        {filters.before ? <input name="before" type="hidden" value={filters.before} /> : null}
        <label className={styles.compactField}>
          <span>Статус</span>
          <select defaultValue={filters.status ?? ""} name="status">
            <option value="">Все статусы</option>
            <option value="ACTIVE">Активные</option>
            {CONTACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONTACT_STATUS_LABELS[status]}
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
            Сбросить
          </Link>
        </div>
      </form>

      <div className={styles.listSummary} aria-live="polite">
        <span>Найдено: {result.total}</span>
        <span>По {result.pageSize} на странице</span>
        <span>Страница {result.page} из {result.totalPages}</span>
      </div>

      {result.rows.length ? (
        <table className={styles.contactTable}>
          <caption className={styles.visuallyHidden}>Обращения</caption>
          <thead>
            <tr>
              <th scope="col">Имя</th>
              <th scope="col">Email</th>
              <th scope="col">Получено</th>
              <th scope="col">Статус</th>
              <th scope="col">Сообщение</th>
              <th scope="col">Действие</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((contact) => (
              <tr key={contact.id}>
                <td data-label="Имя">{contact.name}</td>
                <td data-label="Email">
                  <a className={styles.contactEmail} href={contactEmailHref(contact.email)}>
                    {contact.email}
                  </a>
                </td>
                <td data-label="Получено">
                  <time dateTime={contact.createdAt.toISOString()}>
                    {dateTimeFormatter.format(contact.createdAt)} МСК
                  </time>
                </td>
                <td data-label="Статус">
                  <ContactStatusBadge status={contact.status} />
                </td>
                <td className={styles.contactExcerpt} data-label="Сообщение">
                  {contactExcerpt(contact.message)}
                </td>
                <td data-label="Действие">
                  <Link
                    className={styles.contactDetailLink}
                    href={`/admin/messages/${encodeURIComponent(contact.id)}?returnTo=${encodeURIComponent(messagesHref(filters, result.page))}`}
                    prefetch={false}
                  >
                    Открыть обращение {contact.name}
                    <ChevronRight aria-hidden="true" size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.emptyState}>
          <h2>Обращения не найдены</h2>
          <p>Измените фильтры или очистите их, чтобы увидеть другие записи.</p>
          <Link className={styles.primaryLink} href="/admin/messages">
            Сбросить фильтры
          </Link>
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
            <span className={styles.paginationPlaceholder} />
          )}
          <div className={styles.paginationPages}>
            {paginationItems(result.page, result.totalPages).map((item) =>
              item.type === "ellipsis" ? (
                <span aria-hidden="true" key={item.key}>
                  …
                </span>
              ) : item.page === result.page ? (
                <span aria-current="page" key={item.page}>
                  {item.page}
                </span>
              ) : (
                <Link href={messagesHref(filters, item.page)} key={item.page}>
                  {item.page}
                </Link>
              ),
            )}
          </div>
          {result.page < result.totalPages ? (
            <Link href={messagesHref(filters, result.page + 1)}>
              Далее
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ) : (
            <span className={styles.paginationPlaceholder} />
          )}
        </nav>
      ) : null}
    </section>
  );
}
