import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminNews,
  listAdminNewsPage,
} from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";
import { parseContentListFilters, contentEditorHref } from "@/features/content-admin/list-filters";

import styles from "../../admin.module.css";
import { ContentList, FormSuccess } from "../content-ui";
import { ContentListControls, ContentListPagination } from "../content-list-controls";

const updatedAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export type NewsPageDependencies = {
  requireSession: () => Promise<unknown>;
  listNews: typeof listAdminNewsPage;
  getNews: typeof getAdminNews;
  showNotFound: typeof notFound;
};

export const defaultNewsPageDependencies: NewsPageDependencies = {
  requireSession: requireAdminSession,
  listNews: listAdminNewsPage,
  getNews: getAdminNews,
  showNotFound: notFound,
};

export async function renderNewsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: NewsPageDependencies = defaultNewsPageDependencies,
) {
  await dependencies.requireSession();
  const parsedFilters = parseContentListFilters(searchParams);
  const result = await dependencies.listNews(parsedFilters);
  const filters = { ...parsedFilters, page: result.page };
  const news = result.items;

  return (
    <section className={styles.dashboard} aria-labelledby="news-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="news-title">Новости</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href={contentEditorHref("/admin/news", "new", filters)}
        >
          <Plus aria-hidden="true" size={18} />
          Создать новость
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Новость удалена" : undefined}
        </FormSuccess>
        <ContentListControls path="/admin/news" filters={filters} />
        <ContentList
          caption="Новости фонда"
          emptyMessage={filters.q || filters.status ? "По вашему запросу ничего не найдено" : "Новостей пока нет"}
          items={news.map((newsPost) => ({
            id: newsPost.id,
            title: newsPost.title,
            status: newsPost.status,
            updatedAt: updatedAtFormatter.format(newsPost.updatedAt),
            editHref: contentEditorHref("/admin/news", newsPost.id, filters),
            publicHref: `/news/${encodeURIComponent(newsPost.slug)}`,
          }))}
        />
        <ContentListPagination path="/admin/news" filters={filters} page={result.page} total={result.total} totalPages={result.totalPages} />
      </div>
    </section>
  );
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderNewsPage(await searchParams);
}
