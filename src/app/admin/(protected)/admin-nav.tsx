"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Bell,
  FileText,
  FolderKanban,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  Mail,
  Newspaper,
} from "lucide-react";

import styles from "../admin.module.css";

const adminSections = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/notifications", label: "Уведомления", icon: Bell },
  { href: "/admin/messages", label: "Письма", icon: Mail },
  { href: "/admin/projects", label: "Проекты", icon: FolderKanban },
  { href: "/admin/news", label: "Новости", icon: Newspaper },
  { href: "/admin/documents", label: "Документы", icon: FileText },
  { href: "/admin/requisites", label: "Реквизиты", icon: Landmark },
  { href: "/admin/donations", label: "Пожертвования", icon: HandCoins },
  { href: "/admin/changes", label: "Изменения", icon: History },
] as const;

export function isAdminSectionCurrent(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function newContactRequestsLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} новых обращений`;
  }

  if (lastDigit === 1) {
    return `${count} новое обращение`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} новых обращения`;
  }

  return `${count} новых обращений`;
}

export function AdminNav({
  newContactRequestCount,
  notificationCount = 0,
}: Readonly<{ newContactRequestCount: number; notificationCount?: number }>) {
  const pathname = usePathname();
  const currentLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentLinkRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "center",
    });
  }, [pathname]);

  return (
    <nav className={styles.adminNav} aria-label="Разделы административной части">
      {adminSections.map(({ href, icon: Icon, label }) => {
        const isCurrent = isAdminSectionCurrent(pathname, href);
        const count = href === "/admin/messages" ? newContactRequestCount
          : href === "/admin/notifications" ? notificationCount : 0;
        const accessibleLabel = count > 0
          ? href === "/admin/messages"
            ? `${label} ${newContactRequestsLabel(count)}`
            : `${label}: ${count}`
          : undefined;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            aria-label={accessibleLabel}
            href={href}
            key={href}
            ref={isCurrent ? currentLinkRef : undefined}
          >
            <Icon aria-hidden="true" size={17} />
            {label}
            {count > 0 ? (
              <span aria-hidden="true" className={styles.adminNavBadge}>
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
