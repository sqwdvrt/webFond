import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { ProjectCard } from "@/components/content/project-card";
import { SectionHeading } from "@/components/content/section-heading";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Цели, предмет и виды деятельности фонда", description: "Виды деятельности фонда «Быть Добру» по уставу.", alternates: { canonical: "/projects" } };

export default function ProjectsPage() { return <><PageHero eyebrow="Устав фонда" title="Цели, предмет и виды деятельности фонда" description="Конкретные программы и проекты будут опубликованы после их утверждения фондом" /><section className="page-section"><div className="container"><SectionHeading number="01" title="Виды деятельности по уставу" intro="На странице перечислены виды деятельности из устава фонда." /><div className="project-grid">{projects.map((project) => <ProjectCard key={project.description} project={project} />)}</div></div></section></>; }
