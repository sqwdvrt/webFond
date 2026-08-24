import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminDocument,
  listAdminDocuments,
} from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";
import { ContentList, FormSuccess } from "../content-ui";

const updatedAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export type DocumentPageDependencies = {
  requireSession: () => Promise<unknown>;
  listDocuments: typeof listAdminDocuments;
  getDocument: typeof getAdminDocument;
  showNotFound: typeof notFound;
};

export const defaultDocumentPageDependencies: DocumentPageDependencies = {
  requireSession: requireAdminSession,
  listDocuments: listAdminDocuments,
  getDocument: getAdminDocument,
  showNotFound: notFound,
};

export async function renderDocumentsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: DocumentPageDependencies = defaultDocumentPageDependencies,
) {
  await dependencies.requireSession();
  const documents = await dependencies.listDocuments();

  return (
    <section className={styles.dashboard} aria-labelledby="documents-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="documents-title">Документы</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href="/admin/documents/new"
        >
          <Plus aria-hidden="true" size={18} />
          Создать документ
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Документ удален" : undefined}
        </FormSuccess>
        <ContentList
          caption="Документы фонда"
          emptyMessage="Документов пока нет"
          items={documents.map((document) => ({
            id: document.id,
            title: document.title,
            status: document.status,
            updatedAt: updatedAtFormatter.format(document.updatedAt),
            editHref: `/admin/documents/${document.id}`,
          }))}
        />
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
