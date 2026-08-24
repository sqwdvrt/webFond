import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminProject,
  listAdminProjects,
} from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";
import { ContentList, FormSuccess } from "../content-ui";

const updatedAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export type ProjectPageDependencies = {
  requireSession: () => Promise<unknown>;
  listProjects: typeof listAdminProjects;
  getProject: typeof getAdminProject;
  showNotFound: typeof notFound;
};

export const defaultProjectPageDependencies: ProjectPageDependencies = {
  requireSession: requireAdminSession,
  listProjects: listAdminProjects,
  getProject: getAdminProject,
  showNotFound: notFound,
};

export async function renderProjectsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: ProjectPageDependencies = defaultProjectPageDependencies,
) {
  await dependencies.requireSession();
  const projects = await dependencies.listProjects();

  return (
    <section className={styles.dashboard} aria-labelledby="projects-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="projects-title">Проекты</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href="/admin/projects/new"
        >
          <Plus aria-hidden="true" size={18} />
          Создать проект
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Проект удален" : undefined}
        </FormSuccess>
        <ContentList
          caption="Проекты фонда"
          emptyMessage="Проектов пока нет"
          items={projects.map((project) => ({
            id: project.id,
            title: project.title,
            status: project.status,
            updatedAt: updatedAtFormatter.format(project.updatedAt),
            editHref: `/admin/projects/${project.id}`,
          }))}
        />
      </div>
    </section>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderProjectsPage(await searchParams);
}
