import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { safeContentReturnTo } from "@/features/content-admin/list-filters";

import { createDocumentAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { DocumentForm } from "../document-form";
import {
  defaultDocumentPageDependencies,
  type DocumentPageDependencies,
} from "../page";

export async function renderNewDocumentPage(
  dependencies: DocumentPageDependencies = defaultDocumentPageDependencies,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  await dependencies.requireSession();
  const returnTo = safeContentReturnTo(searchParams.returnTo, "/admin/documents");

  return (
    <section className={styles.dashboard} aria-labelledby="new-document-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href={returnTo}>
            <ChevronLeft aria-hidden="true" size={16} />
            Документы
          </Link>
          <h1 id="new-document-title">Новый документ</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <DocumentForm mode="create" saveAction={createDocumentAction} returnTo={returnTo} />
      </div>
    </section>
  );
}

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderNewDocumentPage(defaultDocumentPageDependencies, await searchParams);
}
