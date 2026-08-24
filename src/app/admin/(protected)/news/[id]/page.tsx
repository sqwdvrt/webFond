import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import {
  deleteNewsAction,
  updateNewsAction,
} from "../../content-actions";
import styles from "../../../admin.module.css";
import { NewsForm } from "../news-form";
import {
  defaultNewsPageDependencies,
  type NewsPageDependencies,
} from "../page";

export async function renderNewsEditPage(
  params: Promise<{ id: string }>,
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: NewsPageDependencies = defaultNewsPageDependencies,
) {
  await dependencies.requireSession();
  const { id } = await params;
  const newsPost = await dependencies.getNews(id);

  if (!newsPost) dependencies.showNotFound();

  const saveAction = updateNewsAction.bind(null, newsPost.id);
  const removeAction = deleteNewsAction.bind(null, newsPost.id, newsPost.slug);
  const successMessage =
    searchParams.success === "created"
      ? "Новость создана"
      : searchParams.success === "saved"
        ? "Новость сохранена"
        : undefined;

  return (
    <section className={styles.dashboard} aria-labelledby="edit-news-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/news">
            <ChevronLeft aria-hidden="true" size={16} />
            Новости
          </Link>
          <h1 id="edit-news-title">Редактирование новости</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <NewsForm
          deleteAction={removeAction}
          initialValues={newsPost}
          mode="edit"
          saveAction={saveAction}
          successMessage={successMessage}
        />
      </div>
    </section>
  );
}

export default async function NewsEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderNewsEditPage(params, await searchParams);
}
