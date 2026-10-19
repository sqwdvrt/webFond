import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { safeContentReturnTo } from "@/features/content-admin/list-filters";

import { createNewsAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { NewsForm } from "../news-form";
import {
  defaultNewsPageDependencies,
  type NewsPageDependencies,
} from "../page";

export async function renderNewNewsPage(
  dependencies: NewsPageDependencies = defaultNewsPageDependencies,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  await dependencies.requireSession();
  const returnTo = safeContentReturnTo(searchParams.returnTo, "/admin/news");

  return (
    <section className={styles.dashboard} aria-labelledby="new-news-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href={returnTo}>
            <ChevronLeft aria-hidden="true" size={16} />
            Новости
          </Link>
          <h1 id="new-news-title">Новая новость</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <NewsForm mode="create" saveAction={createNewsAction} returnTo={returnTo} />
      </div>
    </section>
  );
}

export default async function NewNewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderNewNewsPage(defaultNewsPageDependencies, await searchParams);
}
