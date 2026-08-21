import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { ProjectCard } from "@/components/content/project-card";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Направления помощи", description: "Три направления работы фонда «Быть Добру».", alternates: { canonical: "/projects" } };

export default function ProjectsPage() { return <><PageHero eyebrow="Направления" title="Проекты фонда" description="Сейчас мы формируем программы в трех уставных направлениях помощи." /><section className="page-section"><div className="container project-grid">{projects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div></section></>; }
