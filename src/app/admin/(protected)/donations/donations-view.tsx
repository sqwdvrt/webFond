import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";

import {
  buildDonationQuery,
} from "@/features/admin-donations/filters";
import {
  DONATION_STATUS_LABELS,
  formatDonationAmount,
  formatDonationDateTime,
} from "@/features/admin-donations/format";
import type { DonationPageResult } from "@/features/admin-donations/repository";
import {
  DONATION_STATUSES,
  type DonationPageFilters,
} from "@/features/admin-donations/types";

import styles from "../../admin.module.css";

function donationsHref(filters: DonationPageFilters, page: number) {
  const query = buildDonationQuery({ ...filters, page });
  return `/admin/donations${query.size ? `?${query}` : ""}`;
}

export function InvalidDonationFilters() {
  return (
    <section className={styles.donationsPage}>
      <div className={styles.donationsHeading}>
        <div>
          <span className={styles.eyebrow}>Административная часть</span>
          <h1>Некорректные фильтры</h1>
        </div>
      </div>
      <div className={styles.emptyState}>
        <p>Проверьте статус, даты, строку поиска и номер страницы.</p>
        <Link className={styles.primaryLink} href="/admin/donations">
          Сбросить фильтры
        </Link>
      </div>
    </section>
  );
}

export function DonationsView({
  filters,
  result,
}: {
  filters: DonationPageFilters;
  result: DonationPageResult;
}) {
  const exportQuery = buildDonationQuery(filters, { includePage: false });
  const exportHref = `/admin/donations/export${exportQuery.size ? `?${exportQuery}` : ""}`;

  return (
    <section className={styles.donationsPage} aria-labelledby="donations-title">
      <div className={styles.donationsHeading}>
        <div>
          <Link className={styles.backLink} href="/admin">
            <ChevronLeft aria-hidden="true" size={16} />
            Административная часть
          </Link>
          <h1 id="donations-title">Пожертвования</h1>
        </div>
        <Link
          className={styles.exportButton}
          href={exportHref}
          prefetch={false}
        >
          <Download aria-hidden="true" size={18} />
          Скачать CSV
        </Link>
      </div>

      <form className={styles.filters} method="get" role="search">
        <label className={styles.compactField}>
          <span>Статус</span>
          <select defaultValue={filters.status ?? ""} name="status">
            <option value="">Все статусы</option>
            {DONATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DONATION_STATUS_LABELS[status]}
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
            placeholder="Имя, email или ID платежа"
            type="search"
          />
        </label>
        <div className={styles.filterActions}>
          <button className={styles.primaryButton} type="submit">
            <Search aria-hidden="true" size={18} />
            Применить
          </button>
          <Link className={styles.clearButton} href="/admin/donations">
            <X aria-hidden="true" size={18} />
            Очистить
          </Link>
        </div>
      </form>

      <div className={styles.listSummary} aria-live="polite">
        <span>Найдено: {result.total}</span>
        <span>
          Страница {result.page} из {result.totalPages}
        </span>
      </div>

      {result.rows.length ? (
        <div className={styles.tableViewport} tabIndex={0}>
          <table className={styles.donationsTable}>
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Сумма</th>
                <th scope="col">Статус</th>
                <th scope="col">Плательщик</th>
                <th scope="col">Email</th>
                <th scope="col">ID платежа</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((donation) => (
                <tr key={donation.id}>
                  <td>{formatDonationDateTime(donation.createdAt)}</td>
                  <td className={styles.amountCell}>
                    {formatDonationAmount(
                      donation.amountKopecks,
                      donation.currency,
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${styles[`status${donation.status}`]}`}
                    >
                      {DONATION_STATUS_LABELS[donation.status]}
                    </span>
                  </td>
                  <td>{donation.donorName ?? "—"}</td>
                  <td>{donation.donorEmail ?? "—"}</td>
                  <td className={styles.paymentId}>
                    {donation.providerPaymentId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h2>Пожертвования не найдены</h2>
          <p>Измените фильтры или очистите их, чтобы увидеть другие записи.</p>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Страницы пожертвований">
          {result.page > 1 ? (
            <Link href={donationsHref(filters, result.page - 1)}>
              <ChevronLeft aria-hidden="true" size={18} />
              Назад
            </Link>
          ) : (
            <span />
          )}
          {result.page < result.totalPages ? (
            <Link href={donationsHref(filters, result.page + 1)}>
              Далее
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
