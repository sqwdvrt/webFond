import Link from "next/link";

import { buildContentListUrl, type ContentListFilters, type ContentListPath } from "@/features/content-admin/list-filters";
import styles from "./content-list-controls.module.css";

export function ContentListControls({ path, filters }: { path: ContentListPath; filters: ContentListFilters }) {
  return (
    <form key={buildContentListUrl(path, filters)} className={styles.filters} role="search" aria-label="Поиск материалов" action={path} method="get">
      <label className={styles.search}>
        Поиск
        <input type="search" name="q" maxLength={120} defaultValue={filters.q} />
      </label>
      <label>
        Статус
        <select name="status" defaultValue={filters.status}>
          <option value="">Все статусы</option>
          <option value="DRAFT">Черновики</option>
          <option value="PUBLISHED">Опубликованные</option>
          <option value="ARCHIVED">В архиве</option>
        </select>
      </label>
      <label>
        Сортировка
        <select name="sort" defaultValue={filters.sort}>
          <option value="updated-desc">Сначала недавно изменённые</option>
          <option value="updated-asc">Сначала давно изменённые</option>
        </select>
      </label>
      <button type="submit">Применить</button>
      <Link href={path}>Сбросить фильтры</Link>
    </form>
  );
}

export function ContentListPagination({ path, filters, page, total, totalPages }: {
  path: ContentListPath;
  filters: ContentListFilters;
  page: number;
  total: number;
  totalPages: number;
}) {
  return (
    <nav className={styles.pagination} aria-label="Страницы списка">
      <span>Всего: {total}</span>
      {page > 1 && <Link aria-label="Предыдущая страница" href={buildContentListUrl(path, { ...filters, page: page - 1 })}>Назад</Link>}
      <span aria-current="page">Страница {page} из {totalPages}</span>
      {page < totalPages && <Link aria-label="Следующая страница" href={buildContentListUrl(path, { ...filters, page: page + 1 })}>Далее</Link>}
    </nav>
  );
}
