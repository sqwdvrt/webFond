import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { ProjectCard } from "@/components/content/project-card";
import { SectionHeading } from "@/components/content/section-heading";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Направления помощи", description: "Три направления работы фонда «Быть Добру».", alternates: { canonical: "/projects" } };

export default function ProjectsPage() { return <><PageHero eyebrow="Направления" title="Проекты фонда" description="Три направления работы основаны на уставных целях фонда." /><section className="page-section"><div className="container"><SectionHeading number="01" title="Направления работы" intro="Информация о конкретных программах появится после утверждения." /><div className="project-grid">{projects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div></div></section></>; }
