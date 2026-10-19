import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAdminProject,
  listAdminProjectsPage,
} from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";
import { parseContentListFilters, contentEditorHref } from "@/features/content-admin/list-filters";

import styles from "../../admin.module.css";
import { ContentList, FormSuccess } from "../content-ui";
import { ContentListControls, ContentListPagination } from "../content-list-controls";

const updatedAtFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

export type ProjectPageDependencies = {
  requireSession: () => Promise<unknown>;
  listProjects: typeof listAdminProjectsPage;
  getProject: typeof getAdminProject;
  showNotFound: typeof notFound;
};

export const defaultProjectPageDependencies: ProjectPageDependencies = {
  requireSession: requireAdminSession,
  listProjects: listAdminProjectsPage,
  getProject: getAdminProject,
  showNotFound: notFound,
};

export async function renderProjectsPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: ProjectPageDependencies = defaultProjectPageDependencies,
) {
  await dependencies.requireSession();
  const parsedFilters = parseContentListFilters(searchParams);
  const result = await dependencies.listProjects(parsedFilters);
  const filters = { ...parsedFilters, page: result.page };
  const projects = result.items;

  return (
    <section className={styles.dashboard} aria-labelledby="projects-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="projects-title">Проекты</h1>
        </div>
        <Link
          className={`${styles.primaryButton} ${styles.primaryLink}`}
          href={contentEditorHref("/admin/projects", "new", filters)}
        >
          <Plus aria-hidden="true" size={18} />
          Создать проект
        </Link>
      </div>

      <div className={styles.dashboardContent}>
        <FormSuccess>
          {searchParams.success === "deleted" ? "Проект удален" : undefined}
        </FormSuccess>
        <ContentListControls path="/admin/projects" filters={filters} />
        <ContentList
          caption="Проекты фонда"
          emptyMessage={filters.q || filters.status ? "По вашему запросу ничего не найдено" : "Проектов пока нет"}
          items={projects.map((project) => ({
            id: project.id,
            title: project.title,
            status: project.status,
            updatedAt: updatedAtFormatter.format(project.updatedAt),
            editHref: contentEditorHref("/admin/projects", project.id, filters),
            publicHref: `/projects/${encodeURIComponent(project.slug)}`,
          }))}
        />
        <ContentListPagination path="/admin/projects" filters={filters} page={result.page} total={result.total} totalPages={result.totalPages} />
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
