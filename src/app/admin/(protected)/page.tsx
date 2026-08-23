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
        <div className={styles.adminNavigation}>
          <Link href="/admin/donations">
            <HandCoins aria-hidden="true" size={22} />
            <span>
              <strong>Пожертвования</strong>
              <small>Список, фильтры и CSV-экспорт</small>
            </span>
            <ArrowRight aria-hidden="true" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
import { ArrowRight, HandCoins } from "lucide-react";
import Link from "next/link";
