import type { ProjectContent } from "@/content/projects";

type ProjectCardProps = {
  project: ProjectContent;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return <article className="project-card"><span className="project-status">{project.status}</span><h3>{project.description}</h3></article>;
}
