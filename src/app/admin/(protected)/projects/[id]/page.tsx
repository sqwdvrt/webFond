import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import {
  deleteProjectAction,
  updateProjectAction,
} from "../../content-actions";
import styles from "../../../admin.module.css";
import { ProjectForm } from "../project-form";
import {
  defaultProjectPageDependencies,
  type ProjectPageDependencies,
} from "../page";

export async function renderProjectEditPage(
  params: Promise<{ id: string }>,
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: ProjectPageDependencies = defaultProjectPageDependencies,
) {
  await dependencies.requireSession();
  const { id } = await params;
  const project = await dependencies.getProject(id);

  if (!project) dependencies.showNotFound();

  const saveAction = updateProjectAction.bind(null, project.id);
  const removeAction = deleteProjectAction.bind(null, project.id, project.slug);
  const successMessage =
    searchParams.success === "created"
      ? "Проект создан"
      : searchParams.success === "saved"
        ? "Проект сохранен"
        : undefined;

  return (
    <section className={styles.dashboard} aria-labelledby="edit-project-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/projects">
            <ChevronLeft aria-hidden="true" size={16} />
            Проекты
          </Link>
          <h1 id="edit-project-title">Редактирование проекта</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <ProjectForm
          deleteAction={removeAction}
          initialValues={project}
          mode="edit"
          saveAction={saveAction}
          successMessage={successMessage}
        />
      </div>
    </section>
  );
}

export default async function ProjectEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderProjectEditPage(params, await searchParams);
}
