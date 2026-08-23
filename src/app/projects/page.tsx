import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { projects } from "@/content/projects";

export const metadata: Metadata = { title: "Цели, предмет и виды деятельности фонда", description: "Виды деятельности фонда «Быть Добру» по уставу.", alternates: { canonical: "/projects" } };

export default function ProjectsPage() { return <><PageHero eyebrow="Устав фонда" title="Цели, предмет и виды деятельности фонда" description="Фонд помогает людям, которым особенно нужна поддержка, и объединяет необходимые для этого усилия и средства." /><section className="page-section"><div className="container"><ul className="activity-list" role="list">{projects.map((project) => <li key={project.description}>{project.homepageDescription}</li>)}</ul></div></section></>; }
