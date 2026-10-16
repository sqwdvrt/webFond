import {
  LogOut,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import styles from "../admin.module.css";
import { logoutAction } from "./actions";
import { AdminNav } from "./admin-nav";

export function AdminShell({
  children,
  newContactRequestCount,
  username,
}: Readonly<{
  children: React.ReactNode;
  newContactRequestCount: number;
  username: string;
}>) {
  return (
    <div className={styles.workspace}>
      <a className={styles.skipLink} href="#admin-main">
        К содержанию
      </a>

      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderInner}>
          <Link className={styles.workspaceBrand} href="/admin">
            <span>Фонд «Быть Добру»</span>
            <strong>Административная часть</strong>
          </Link>

          <div className={styles.accountControls}>
            <span className={styles.currentAccount}>
              <UserRound aria-hidden="true" size={18} />
              <span>{username}</span>
            </span>
            <form action={logoutAction}>
              <button className={styles.logoutButton} type="submit">
                <LogOut aria-hidden="true" size={17} />
                Выйти
              </button>
            </form>
          </div>
        </div>

        <div className={styles.adminNavFrame}>
          <div className={styles.adminNavViewport}>
            <AdminNav newContactRequestCount={newContactRequestCount} />
          </div>
        </div>
      </header>

      <main className={styles.workspaceMain} id="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
