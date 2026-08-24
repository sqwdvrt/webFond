import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import {
  deleteDocumentAction,
  updateDocumentAction,
} from "../../content-actions";
import styles from "../../../admin.module.css";
import { DocumentForm } from "../document-form";
import {
  defaultDocumentPageDependencies,
  type DocumentPageDependencies,
} from "../page";

export async function renderDocumentEditPage(
  params: Promise<{ id: string }>,
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: DocumentPageDependencies = defaultDocumentPageDependencies,
) {
  await dependencies.requireSession();
  const { id } = await params;
  const document = await dependencies.getDocument(id);

  if (!document) dependencies.showNotFound();

  const saveAction = updateDocumentAction.bind(null, document.id);
  const removeAction = deleteDocumentAction.bind(null, document.id);
  const successMessage =
    searchParams.success === "created"
      ? "Документ создан"
      : searchParams.success === "saved"
        ? "Документ сохранен"
        : undefined;

  return (
    <section className={styles.dashboard} aria-labelledby="edit-document-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/documents">
            <ChevronLeft aria-hidden="true" size={16} />
            Документы
          </Link>
          <h1 id="edit-document-title">Редактирование документа</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <DocumentForm
          deleteAction={removeAction}
          initialValues={document}
          mode="edit"
          saveAction={saveAction}
          successMessage={successMessage}
        />
      </div>
    </section>
  );
}

export default async function DocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderDocumentEditPage(params, await searchParams);
}
