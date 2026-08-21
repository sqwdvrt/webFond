import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/content/page-hero";
import { getProjectBySlug, projects } from "@/content/projects";
import { siteConfig } from "@/config/site";

type ProjectPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return projects.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params; const project = getProjectBySlug(slug);
  if (!project) return { title: "Направление не найдено", robots: { index: false, follow: true } };
  return { title: project.title, description: project.description, alternates: { canonical: project.href } };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params; const project = getProjectBySlug(slug); if (!project) notFound();
  return <><PageHero eyebrow={project.status} title={project.title} description={project.description} /><section className="page-section"><div className="container text-grid"><div><span className="section-number">01 О направлении</span></div><div className="prose"><h2>Поддержка в рамках целей фонда</h2><p>{project.detail}</p><p>Информация о конкретных программах и порядке участия появится после утверждения.</p><Link className="button button-primary" href={siteConfig.routes.contactsForHelp}>Связаться с фондом</Link></div></div></section></>;
}
