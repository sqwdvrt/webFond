import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/content/page-hero";
import { PublishedDetail } from "@/components/content/published-content";
import { FundraisingMeter } from "@/components/fundraising/fundraising-meter";
import { getPublishedProjectForRequest } from "@/features/content-admin/public-loaders";

type ProjectDetailProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProjectDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProjectForRequest(slug);

  if (!project) return {};

  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

export default async function ProjectPage({ params }: ProjectDetailProps) {
  const { slug } = await params;
  const project = await getPublishedProjectForRequest(slug);

  if (!project) notFound();

  return (
    <>
      <PageHero eyebrow="Проект фонда" title={project.title} description={project.summary ?? ""} />
      <PublishedDetail
        content={project.content ?? ""}
        imageUrl={project.imageUrl}
        publishedAt={project.publishedAt}
        title={project.title}
      />
      {project.fundraising ? (
        <section className="page-section">
          <div className="container published-detail">
            <FundraisingMeter
              helpHref={`/help?project=${project.slug}`}
              progress={project.fundraising}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
