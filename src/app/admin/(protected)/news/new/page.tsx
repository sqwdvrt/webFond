import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { createNewsAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { NewsForm } from "../news-form";
import {
  defaultNewsPageDependencies,
  type NewsPageDependencies,
} from "../page";

export async function renderNewNewsPage(
  dependencies: NewsPageDependencies = defaultNewsPageDependencies,
) {
  await dependencies.requireSession();

  return (
    <section className={styles.dashboard} aria-labelledby="new-news-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/news">
            <ChevronLeft aria-hidden="true" size={16} />
            Новости
          </Link>
          <h1 id="new-news-title">Новая новость</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <NewsForm mode="create" saveAction={createNewsAction} />
      </div>
    </section>
  );
}

export default async function NewNewsPage() {
  return renderNewNewsPage();
}
