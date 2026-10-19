import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminDocument,
  listAdminDocumentsPage,
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

export type DocumentPageDependencies = {
  requireSession: () => Promise<unknown>;
  listDocuments: typeof listAdminDocumentsPage;
  getDocument: typeof getAdminDocument;
  showNotFound: typeof notFound;
};

export const defaultDocumentPageDependencies: DocumentPageDependencies = {
  requireSession: requireAdminSession,
  listDocuments: listAdminDocumentsPage,
  getDocument: getAdminDocument,
  showNotFound: notFound,
};

export async function renderDocumentsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: DocumentPageDependencies = defaultDocumentPageDependencies,
) {
  await dependencies.requireSession();
  const parsedFilters = parseContentListFilters(searchParams);
  const result = await dependencies.listDocuments(parsedFilters);
  const filters = { ...parsedFilters, page: result.page };
  const documents = result.items;

  return (
    <section className={styles.dashboard} aria-labelledby="documents-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="documents-title">Документы</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href={contentEditorHref("/admin/documents", "new", filters)}
        >
          <Plus aria-hidden="true" size={18} />
          Создать документ
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Документ удален" : undefined}
        </FormSuccess>
        <ContentListControls path="/admin/documents" filters={filters} />
        <ContentList
          caption="Документы фонда"
          emptyMessage={filters.q || filters.status ? "По вашему запросу ничего не найдено" : "Документов пока нет"}
          items={documents.map((document) => ({
            id: document.id,
            title: document.title,
            status: document.status,
            updatedAt: updatedAtFormatter.format(document.updatedAt),
            editHref: contentEditorHref("/admin/documents", document.id, filters),
            publicHref: document.fileUrl,
            publicLabel: "Открыть файл",
          }))}
        />
        <ContentListPagination path="/admin/documents" filters={filters} page={result.page} total={result.total} totalPages={result.totalPages} />
      </div>
    </section>
  );
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderDocumentsPage(await searchParams);
}
