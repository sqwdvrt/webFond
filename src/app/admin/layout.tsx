import type { Metadata } from "next";

import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Административная часть",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={styles.adminShell}>{children}</div>;
}
