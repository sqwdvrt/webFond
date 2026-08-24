import {
  ArrowRight,
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  Newspaper,
} from "lucide-react";
import Link from "next/link";

import styles from "../admin.module.css";

const overviewSections = [
  {
    href: "/admin/projects",
    label: "Проекты",
    description: "Публикация и обновление программ фонда",
    icon: FolderKanban,
  },
  {
    href: "/admin/news",
    label: "Новости",
    description: "Материалы и события фонда",
    icon: Newspaper,
  },
  {
    href: "/admin/documents",
    label: "Документы",
    description: "Отчеты и публичные документы",
    icon: FileText,
  },
  {
    href: "/admin/requisites",
    label: "Реквизиты",
    description: "Юридические и банковские данные",
    icon: Landmark,
  },
  {
    href: "/admin/donations",
    label: "Пожертвования",
    description: "Список, фильтры и CSV-экспорт",
    icon: HandCoins,
  },
] as const;

export default function AdminPage() {
  return (
    <section className={styles.dashboard} aria-labelledby="admin-title">
      <div className={styles.dashboardHeader}>
        <div>
          <span className={styles.eyebrow}>Рабочая область</span>
          <h1 id="admin-title">Обзор</h1>
        </div>
      </div>

      <nav
        className={styles.overviewNavigation}
        aria-label="Управление разделами"
      >
        {overviewSections.map(({ description, href, icon: Icon, label }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden="true" size={20} />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ))}
      </nav>
    </section>
  );
}
