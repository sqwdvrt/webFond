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
      <div className="container published-body legal-document">
        <h1>{document.title}</h1>
        {document.fileHref ? (
          <p className="quiet-row">
            <a download href={document.fileHref}>
              {document.fileLabel ?? "Скачать документ Word"}
            </a>
          </p>
        ) : null}
        <nav className="document-contents" aria-label="Содержание документа">
          <details>
            <summary id="document-contents">Содержание документа</summary>
            <ol>
              {document.sections.map((section, index) => (
                <li key={index}><a href={`#document-section-${index + 1}`}>{section.heading}</a></li>
              ))}
            </ol>
          </details>
        </nav>
        {document.sections.map((section, sectionIndex) => (
          <section key={sectionIndex}>
            <h2 id={`document-section-${sectionIndex + 1}`} tabIndex={-1}>{section.heading}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p className="quiet-row"><a href="#document-contents">К содержанию документа</a></p>
      </div>
    </section>
  );
}
