import type { ProjectContent } from "@/content/projects";

type ProjectCardProps = {
  project: ProjectContent;
  compact?: boolean;
  number?: number;
};

export function ProjectCard({ project, compact, number }: ProjectCardProps) {
  if (compact) {
    return <article className="project-card project-card-compact"><span className="project-number">{number?.toString().padStart(2, "0")}</span><h3>{project.description}</h3></article>;
  }

  return <article className="project-card"><span className="project-status">{project.status}</span><h3>{project.description}</h3></article>;
}
