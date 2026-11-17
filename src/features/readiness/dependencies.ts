import { parseReconciliationHeartbeat } from "@/features/admin-dashboard/alerts";

type StatusTransaction = {
  $executeRaw: (strings: TemplateStringsArray) => Promise<unknown>;
  $queryRaw: (strings: TemplateStringsArray) => Promise<unknown>;
  siteSetting: { findUnique: (args: { where: { key: string }; select: { value: true } }) => Promise<{ value: unknown } | null> };
};
export type StatusDatabase = {
  $transaction<T>(run: (tx: StatusTransaction) => Promise<T>, options: { maxWait: number; timeout: number }): Promise<T>;
};
export type DependencyStatus = {
  ok: boolean;
  database: "ok" | "unavailable";
  reconciliation: "disabled" | "ok" | "stale" | "failed" | "unknown";
};

/** Read-only probes, bounded by both transaction and database statement timeouts. */
export async function checkDependencies(database: StatusDatabase, paymentsEnabled: boolean, now = new Date()): Promise<DependencyStatus> {
  try {
    return await database.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      await tx.$queryRaw`SELECT 1`;
      if (!paymentsEnabled) return { ok: true, database: "ok", reconciliation: "disabled" };
      const setting = await tx.siteSetting.findUnique({ where: { key: "paymentsReconciliationHeartbeat" }, select: { value: true } });
      const heartbeat = parseReconciliationHeartbeat(setting?.value, now);
      const reconciliation = !heartbeat.completedAt || now.getTime() - heartbeat.completedAt.getTime() > 15 * 60 * 1000
        ? "stale" : heartbeat.failed ? "failed" : "ok";
      return { ok: reconciliation === "ok", database: "ok", reconciliation };
    }, { maxWait: 1000, timeout: 3000 });
  } catch {
    return { ok: false, database: "unavailable", reconciliation: paymentsEnabled ? "unknown" : "disabled" };
  }
}
