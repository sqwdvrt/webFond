import type { Metadata } from "next";

import type { PublishedLegalDocument } from "@/content/legal";

export function publishedLegalMetadata(
  document: PublishedLegalDocument,
): Metadata {
  return {
    title: document.title,
    description: document.description,
    alternates: { canonical: document.canonical },
  };
}

export function PublishedLegalDocumentView({
  document,
}: {
  document: PublishedLegalDocument;
}) {
  return (
    <section className="page-section">
      <div className="container published-body">
        <h1>{document.title}</h1>
        {document.fileHref ? (
          <p className="quiet-row">
            <a download href={document.fileHref}>
              {document.fileLabel ?? "Скачать документ Word"}
            </a>
          </p>
        ) : null}
        {document.sections.map((section, sectionIndex) => (
          <section key={sectionIndex}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
