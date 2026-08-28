"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "../admin.module.css";

export function isAdminSectionCurrent(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  sections,
}: {
  sections: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }>;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.adminNav} aria-label="Разделы административной части">
      {sections.map(({ href, icon: Icon, label }) => (
        <Link
          aria-current={isAdminSectionCurrent(pathname, href) ? "page" : undefined}
          href={href}
          key={href}
        >
          <Icon aria-hidden="true" size={17} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
