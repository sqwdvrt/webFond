import Link from "next/link";

import { PublishedCard } from "@/components/content/published-content";
import { FundraisingMeter } from "@/components/fundraising/fundraising-meter";
import type { HomeEvidenceData } from "@/features/homepage/evidence";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeZone: "Europe/Moscow",
});

export function HomeEvidence({ data }: { data: HomeEvidenceData }) {
  return (
    <div className="home-evidence">
      <section aria-labelledby="home-projects-heading">
        <h3 id="home-projects-heading">Проекты фонда</h3>
        {data.projects === null ? (
          <p className="status-note" role="status">Не удалось загрузить проекты.</p>
        ) : data.projects.length === 0 ? (
          <p>Проекты пока не опубликованы.</p>
        ) : (
          <div className="published-grid">
            {data.projects.map((project) => (
              <PublishedCard key={project.id} headingLevel={4}
                href={`/projects/${project.slug}`} title={project.title}
                imageUrl={project.imageUrl} publishedAt={project.publishedAt} summary={project.summary}>
                {project.fundraising ? (
                  <FundraisingMeter helpHref={`/help?project=${project.slug}`}
                    progress={project.fundraising} variant="card" />
                ) : null}
              </PublishedCard>
            ))}
          </div>
        )}
        <p className="quiet-row"><Link href="/projects">Все проекты и направления</Link></p>
      </section>
      <section aria-labelledby="home-reports-heading">
        <h3 id="home-reports-heading">Отчёты и документы</h3>
        {data.documents === null ? (
          <p className="status-note" role="status">Не удалось загрузить отчёты.</p>
        ) : data.documents.length === 0 ? (
          <p>Отчёты пока не опубликованы.</p>
        ) : (
          <ul className="home-report-list">
            {data.documents.map((document) => {
              const external = /^https:\/\//i.test(document.fileUrl);
              return (
                <li key={document.id}>
                  <Link href={document.fileUrl} target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}>{document.title}</Link>
                  <span>{document.category}</span>
                  {document.publishedAt ? (
                    <span>Опубликован: <time dateTime={document.publishedAt.toISOString()}>{dateFormatter.format(document.publishedAt)}</time></span>
                  ) : null}
                  <span>Документ обновлён: <time dateTime={document.updatedAt.toISOString()}>{dateFormatter.format(document.updatedAt)}</time></span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="quiet-row"><Link href="/reports">Все отчёты и документы</Link></p>
      </section>
    </div>
  );
}
