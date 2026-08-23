import { requireAdminSession } from "@/lib/admin-auth/session";

import styles from "../admin.module.css";
import { logoutAction } from "./actions";

export default async function AdminPage() {
  const session = await requireAdminSession();

  return (
    <section className={styles.dashboard} aria-labelledby="admin-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Фонд «Быть Добру»</span>
          <h1 id="admin-title">Административная часть</h1>
        </div>
        <form action={logoutAction}>
          <button className={styles.secondaryButton} type="submit">
            Выйти
          </button>
        </form>
      </div>

      <div className={styles.dashboardContent}>
        <p className={styles.accountLabel}>Текущая учетная запись</p>
        <p className={styles.accountName}>{session.username}</p>
        <p className={styles.dashboardNote}>
          Управление проектами, новостями и документами будет добавлено в
          следующем срезе этапа 3.
        </p>
      </div>
    </section>
  );
}
