import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { createProjectAction } from "../../content-actions";
import styles from "../../../admin.module.css";
import { ProjectForm } from "../project-form";
import {
  defaultProjectPageDependencies,
  type ProjectPageDependencies,
} from "../page";

export async function renderNewProjectPage(
  dependencies: ProjectPageDependencies = defaultProjectPageDependencies,
) {
  await dependencies.requireSession();

  return (
    <section className={styles.dashboard} aria-labelledby="new-project-title">
      <div className={styles.dashboardHeader}>
        <div>
          <Link className={styles.backLink} href="/admin/projects">
            <ChevronLeft aria-hidden="true" size={16} />
            Проекты
          </Link>
          <h1 id="new-project-title">Новый проект</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <ProjectForm mode="create" saveAction={createProjectAction} />
      </div>
    </section>
  );
}

export default async function NewProjectPage() {
  return renderNewProjectPage();
}
