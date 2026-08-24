import { getAdminRequisites } from "@/features/content-admin/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../../admin.module.css";
import {
  replaceInvalidRequisitesAction,
  saveRequisitesAction,
} from "../content-actions";
import { RequisitesForm } from "./requisites-form";

export type RequisitesPageDependencies = {
  requireSession: () => Promise<unknown>;
  getRequisites: typeof getAdminRequisites;
};

export const defaultRequisitesPageDependencies: RequisitesPageDependencies = {
  requireSession: requireAdminSession,
  getRequisites: getAdminRequisites,
};

export async function renderRequisitesPage(
  searchParams: Record<string, string | string[] | undefined>,
  dependencies: RequisitesPageDependencies = defaultRequisitesPageDependencies,
) {
  await dependencies.requireSession();
  const requisites = await dependencies.getRequisites();
  const successMessage =
    searchParams.success === "saved"
      ? "Реквизиты сохранены"
      : searchParams.success === "replaced"
        ? "Реквизиты заменены безопасным черновиком"
        : undefined;

  return (
    <section className={styles.dashboard} aria-labelledby="requisites-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Управление контентом</span>
          <h1 id="requisites-title">Реквизиты</h1>
        </div>
      </div>
      <div className={styles.dashboardContent}>
        <RequisitesForm
          replaceAction={replaceInvalidRequisitesAction}
          requisites={requisites}
          saveAction={saveRequisitesAction}
          successMessage={successMessage}
        />
      </div>
    </section>
  );
}

export default async function RequisitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderRequisitesPage(await searchParams);
}
