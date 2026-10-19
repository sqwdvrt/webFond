import type { Prisma } from "@prisma/client";
import { resolveAuditLinks, type AuditLinkClient } from "./activity-links";
import { prisma } from "@/lib/db";

const select = { id: true, action: true, entityType: true, entityId: true, previousStatus: true, nextStatus: true, createdAt: true } satisfies Prisma.AdminAuditEventSelect;
type AuditRow = Prisma.AdminAuditEventGetPayload<{ select: typeof select }>;
type HistoryTransaction = AuditLinkClient & { adminAuditEvent: {
  count(): Promise<number>;
  findMany(args: { select: typeof select; orderBy: Prisma.AdminAuditEventOrderByWithRelationInput[]; skip: number; take: number }): Promise<AuditRow[]>;
} };
type HistoryDatabase = { $transaction<T>(callback: (tx: HistoryTransaction) => Promise<T>, options: { isolationLevel: "RepeatableRead" }): Promise<T> };

export function parseAuditPage(value: unknown): number | null {
  if (value === undefined) return 1;
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : null;
}

export function getAuditPage(requestedPage: number, database: HistoryDatabase = prisma) {
  return database.$transaction(async (tx) => {
    const total = await tx.adminAuditEvent.count();
    const totalPages = Math.max(1, Math.ceil(total / 25));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const rows = await tx.adminAuditEvent.findMany({ select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25 });
    const linked = await resolveAuditLinks(rows, tx);
    return { rows: linked.map((row, index) => ({ ...row, reference: rows[index].entityId })), page, total, totalPages };
  }, { isolationLevel: "RepeatableRead" });
}
