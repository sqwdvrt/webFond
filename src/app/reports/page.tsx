import type { Metadata } from "next";

import { CollectionEmpty } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";
import {
  listPublishedDocuments,
  type PublicDocumentRow,
} from "@/features/content-admin/repository";
import { createRequestCachedLoader } from "@/features/content-admin/request-cache";

export const dynamic = "force-dynamic";

type ReportsPageDependencies = {
  listDocuments: () => Promise<PublicDocumentRow[]>;
};

const listPublishedDocumentsForRequest =
  createRequestCachedLoader(listPublishedDocuments);

const defaultDependencies: ReportsPageDependencies = {
  listDocuments: listPublishedDocumentsForRequest,
};

const baseMetadata = {
  title: "Отчеты",
  description: "Документы и отчетность фонда «Быть Добру».",
};

export async function generateReportsMetadata(
  dependencies: ReportsPageDependencies = defaultDependencies,
): Promise<Metadata> {
  try {
    const documents = await dependencies.listDocuments();
    if (documents.length > 0) {
      return {
        ...baseMetadata,
        alternates: { canonical: "/reports" },
        robots: { index: true, follow: true },
      };
    }
  } catch {
    // Failed and empty collections remain non-indexable.
  }

  return {
    ...baseMetadata,
    robots: { index: false, follow: true },
  };
}

export function generateMetadata() {
  return generateReportsMetadata();
}

function groupByCategory(documents: PublicDocumentRow[]) {
  const groups = new Map<string, PublicDocumentRow[]>();

  for (const document of documents) {
    const group = groups.get(document.category);
    if (group) group.push(document);
    else groups.set(document.category, [document]);
  }

  return groups;
}

function isExternalDocument(fileUrl: string) {
  return /^https:\/\//i.test(fileUrl);
}

export async function renderReportsPage(
  dependencies: ReportsPageDependencies = defaultDependencies,
) {
  let documents: PublicDocumentRow[] | null;

  try {
    documents = await dependencies.listDocuments();
  } catch {
    documents = null;
  }

  const groups = documents ? groupByCategory(documents) : null;

  return (
    <>
      <PageHero
        eyebrow="Отчеты"
        title="Отчеты фонда"
        description="Документы и отчетность фонда."
      />
      <section className="page-section">
        <div className="container">
          {groups === null ? (
            <p className="status-note" role="status">
              Отчеты сейчас не открываются. Попробуйте позже.
            </p>
          ) : groups.size === 0 ? (
            <CollectionEmpty
              title="Раздел будет дополнен"
              description="В этом разделе публикуются документы и отчетность фонда."
              links={[
                { href: "/about", label: "О фонде" },
                { href: "/help", label: "Помочь" },
              ]}
            />
          ) : (
            <div className="published-body">
              {Array.from(groups, ([category, categoryDocuments]) => (
                <section data-document-category key={category}>
                  <h2>{category}</h2>
                  <ul>
                    {categoryDocuments.map((document) => {
                      const external = isExternalDocument(document.fileUrl);
                      return (
                        <li key={document.id}>
                          <a
                            href={document.fileUrl}
                            rel={external ? "noopener noreferrer" : undefined}
                            target={external ? "_blank" : undefined}
                          >
                            {document.title}
                            {external ? " (Внешняя ссылка)" : null}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function ReportsPage() {
  return renderReportsPage();
}
