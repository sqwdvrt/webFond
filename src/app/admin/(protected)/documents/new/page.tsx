import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { createDocumentAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { DocumentForm } from "../document-form";
import {
  defaultDocumentPageDependencies,
  type DocumentPageDependencies,
} from "../page";

export async function renderNewDocumentPage(
  dependencies: DocumentPageDependencies = defaultDocumentPageDependencies,
) {
  await dependencies.requireSession();

  return (
    <section className={styles.dashboard} aria-labelledby="new-document-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/documents">
            <ChevronLeft aria-hidden="true" size={16} />
            Документы
          </Link>
          <h1 id="new-document-title">Новый документ</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <DocumentForm mode="create" saveAction={createDocumentAction} />
      </div>
    </section>
  );
}

export default async function NewDocumentPage() {
  return renderNewDocumentPage();
}
