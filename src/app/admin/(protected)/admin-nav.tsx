"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Mail,
  Newspaper,
} from "lucide-react";

import styles from "../admin.module.css";

const adminSections = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/messages", label: "Письма", icon: Mail },
  { href: "/admin/projects", label: "Проекты", icon: FolderKanban },
  { href: "/admin/news", label: "Новости", icon: Newspaper },
  { href: "/admin/documents", label: "Документы", icon: FileText },
  { href: "/admin/requisites", label: "Реквизиты", icon: Landmark },
  { href: "/admin/donations", label: "Пожертвования", icon: HandCoins },
] as const;

export function isAdminSectionCurrent(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const currentLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentLinkRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [pathname]);

  return (
    <nav className={styles.adminNav} aria-label="Разделы административной части">
      {adminSections.map(({ href, icon: Icon, label }) => {
        const isCurrent = isAdminSectionCurrent(pathname, href);

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            href={href}
            key={href}
            ref={isCurrent ? currentLinkRef : undefined}
          >
            <Icon aria-hidden="true" size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
