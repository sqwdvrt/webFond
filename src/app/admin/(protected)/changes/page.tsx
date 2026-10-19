import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth/session";
import { getAuditPage, parseAuditPage } from "@/features/admin-audit/history";
import { ActivityList } from "../activity-list";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function ChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const page = parseAuditPage((await searchParams).page);
  const result = page === null ? null : await getAuditPage(page);
  return <section className={styles.dashboard}>
    <div className={styles.dashboardHeader}><div><span className={styles.eyebrow}>Журнал действий</span><h1>Изменения</h1></div></div>
    <div className={styles.dashboardContent}>
      {page === null ? <p role="alert">Некорректный номер страницы. <Link href="/admin/changes">Открыть журнал</Link></p> : result ? <History result={result} /> : null}
    </div>
  </section>;
}

function History({ result }: { result: Awaited<ReturnType<typeof getAuditPage>> }) {
  return <>
    <p className={styles.activityNote}>Доступ к админке общий; персональный автор действий не определяется. Время указано по Москве.</p>
    <ActivityList events={result.rows} />
    <nav className={styles.pagination} aria-label="Страницы изменений">
      {result.page > 1 ? <Link href={`/admin/changes?page=${result.page - 1}`}>Назад</Link> : <span />}
      <span>Страница {result.page} из {result.totalPages} · Всего: {result.total}</span>
      {result.page < result.totalPages ? <Link href={`/admin/changes?page=${result.page + 1}`}>Далее</Link> : <span />}
    </nav>
  </>;
}
