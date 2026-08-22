import type { ProjectContent } from "@/content/projects";

export function ProjectCard({ project }: { project: ProjectContent }) {
  return <article className="project-card"><span className="project-status">{project.status}</span><h3>{project.description}</h3></article>;
}
