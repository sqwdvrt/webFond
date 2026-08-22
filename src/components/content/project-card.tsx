import type { ProjectContent } from "@/content/projects";

type ProjectCardProps = {
  project: ProjectContent;
  compact?: boolean;
};

export function ProjectCard({ project, compact }: ProjectCardProps) {
  if (compact) {
    return <article className="project-card project-card-compact"><h3>{project.description}</h3></article>;
  }

  return <article className="project-card"><span className="project-status">{project.status}</span><h3>{project.description}</h3></article>;
}
