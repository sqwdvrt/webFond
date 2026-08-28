import type { Metadata } from "next";

import { PageHero } from "@/components/content/page-hero";
import { PublishedCard } from "@/components/content/published-content";
import { charterGroups, projects } from "@/content/projects";
import {
  listPublishedProjects,
  type PublicEditorialListRow,
} from "@/features/content-admin/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Цели, предмет и виды деятельности фонда",
  description: "Виды деятельности фонда «Быть Добру» по уставу.",
  alternates: { canonical: "/projects" },
};

type ProjectPageDependencies = {
  listProjects: () => Promise<PublicEditorialListRow[]>;
};

const defaultDependencies: ProjectPageDependencies = {
  listProjects: listPublishedProjects,
};

export async function renderProjectsPage(
  dependencies: ProjectPageDependencies = defaultDependencies,
) {
  let publishedProjects: PublicEditorialListRow[] | null;

  try {
    publishedProjects = await dependencies.listProjects();
  } catch {
    publishedProjects = null;
  }

  return (
    <>
      <PageHero
        eyebrow="Устав фонда"
        title="Цели, предмет и виды деятельности фонда"
        description="По уставу фонд вправе поддерживать людей, сохранять значимые места и объединять тех, кто хочет помочь. Ниже перечень видов деятельности."
      />
      <section className="page-section">
        <div className="container">
          <div className="charter-groups info-grid">
            {charterGroups.map((group) => (
              <article className="info-card" key={group.title}>
                <h2>{group.title}</h2>
                <p>{group.lead}</p>
              </article>
            ))}
          </div>
          <ul className="activity-list" role="list">
            {projects.map((project) => (
              <li key={project.description}>{project.homepageDescription}</li>
            ))}
          </ul>
        </div>
      </section>
      {publishedProjects === null ? (
        <section className="page-section">
          <div className="container">
            <p className="status-note" role="status">
              Проекты сейчас не открываются. Попробуйте позже.
            </p>
          </div>
        </section>
      ) : publishedProjects.length > 0 ? (
        <section className="page-section surface-band">
          <div className="container">
            <h2 className="published-section-title">Проекты фонда</h2>
            <div className="published-grid">
              {publishedProjects.map((project) => (
                <PublishedCard
                  key={project.id}
                  headingLevel={3}
                  href={`/projects/${project.slug}`}
                  imageUrl={project.imageUrl}
                  publishedAt={project.publishedAt}
                  summary={project.summary}
                  title={project.title}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function ProjectsPage() {
  return renderProjectsPage();
}
