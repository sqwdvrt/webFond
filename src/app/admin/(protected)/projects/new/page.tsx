import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { safeContentReturnTo } from "@/features/content-admin/list-filters";

import { createProjectAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { ProjectForm } from "../project-form";
import {
  defaultProjectPageDependencies,
  type ProjectPageDependencies,
} from "../page";

export async function renderNewProjectPage(
  dependencies: ProjectPageDependencies = defaultProjectPageDependencies,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  await dependencies.requireSession();
  const returnTo = safeContentReturnTo(searchParams.returnTo, "/admin/projects");

  return (
    <section className={styles.dashboard} aria-labelledby="new-project-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href={returnTo}>
            <ChevronLeft aria-hidden="true" size={16} />
            Проекты
          </Link>
          <h1 id="new-project-title">Новый проект</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <ProjectForm mode="create" saveAction={createProjectAction} returnTo={returnTo} />
      </div>
    </section>
  );
}

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderNewProjectPage(defaultProjectPageDependencies, await searchParams);
}
