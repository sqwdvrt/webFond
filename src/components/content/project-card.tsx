import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ProjectContent } from "@/content/projects";

export function ProjectCard({ project }: { project: ProjectContent }) {
  return <article className="project-card"><span className="project-status">{project.status}</span><h3>{project.title}</h3><p>{project.description}</p><Link href={project.href}>Подробнее <ArrowUpRight aria-hidden="true" size={18} /></Link></article>;
}
