import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminNews,
  listAdminNews,
} from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";
import { ContentList, FormSuccess } from "../content-ui";

const updatedAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export type NewsPageDependencies = {
  requireSession: () => Promise<unknown>;
  listNews: typeof listAdminNews;
  getNews: typeof getAdminNews;
  showNotFound: typeof notFound;
};

export const defaultNewsPageDependencies: NewsPageDependencies = {
  requireSession: requireAdminSession,
  listNews: listAdminNews,
  getNews: getAdminNews,
  showNotFound: notFound,
};

export async function renderNewsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: NewsPageDependencies = defaultNewsPageDependencies,
) {
  await dependencies.requireSession();
  const news = await dependencies.listNews();

  return (
    <section className={styles.dashboard} aria-labelledby="news-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="news-title">Новости</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href="/admin/news/new"
        >
          <Plus aria-hidden="true" size={18} />
          Создать новость
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Новость удалена" : undefined}
        </FormSuccess>
        <ContentList
          caption="Новости фонда"
          emptyMessage="Новостей пока нет"
          items={news.map((newsPost) => ({
            id: newsPost.id,
            title: newsPost.title,
            status: newsPost.status,
            updatedAt: updatedAtFormatter.format(newsPost.updatedAt),
            editHref: `/admin/news/${newsPost.id}`,
          }))}
        />
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
