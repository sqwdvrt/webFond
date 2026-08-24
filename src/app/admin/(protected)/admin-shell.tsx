import {
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Newspaper,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import styles from "../admin.module.css";
import { logoutAction } from "./actions";

const sections = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/projects", label: "Проекты", icon: FolderKanban },
  { href: "/admin/news", label: "Новости", icon: Newspaper },
  { href: "/admin/documents", label: "Документы", icon: FileText },
  { href: "/admin/requisites", label: "Реквизиты", icon: Landmark },
  { href: "/admin/donations", label: "Пожертвования", icon: HandCoins },
] as const;

export function AdminShell({
  children,
  username,
}: Readonly<{
  children: React.ReactNode;
  username: string;
}>) {
  return (
    <div className={styles.workspace}>
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

        <div className={styles.adminNavViewport}>
          <nav
            className={styles.adminNav}
            aria-label="Разделы административной части"
          >
            {sections.map(({ href, icon: Icon, label }) => (
              <Link href={href} key={href}>
                <Icon aria-hidden="true" size={17} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.workspaceMain}>{children}</main>
    </div>
  );
}
