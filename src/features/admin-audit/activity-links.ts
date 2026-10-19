import type { SafeAdminAuditEvent } from "@/features/admin-dashboard/read-model";

type IdReader = { findMany(args: { where: { id: { in: string[] } }; select: { id: true } }): Promise<{ id: string }[]> };
export type AuditLinkClient = {
  project: IdReader; newsPost: IdReader; document: IdReader; contactRequest: IdReader; donation: IdReader;
  siteSetting: { findMany(args: { where: { key: "requisites" }; select: { key: true } }): Promise<{ key: string }[]> };
};
export type AuditEventWithEntity = SafeAdminAuditEvent & { entityId: string };

export async function resolveAuditLinks(events: AuditEventWithEntity[], tx: AuditLinkClient): Promise<SafeAdminAuditEvent[]> {
  const targets = {
    PROJECT: [tx.project, "/admin/projects"], NEWS_POST: [tx.newsPost, "/admin/news"],
    DOCUMENT: [tx.document, "/admin/documents"], CONTACT_REQUEST: [tx.contactRequest, "/admin/messages"],
    DONATION: [tx.donation, "/admin/donations"],
  } as const;
  const existing = new Map<string, Set<string>>();
  await Promise.all(Object.entries(targets).map(async ([type, [reader]]) => {
    const ids = [...new Set(events.filter((event) => event.entityType === type && event.entityId).map((event) => event.entityId))];
    if (ids.length) existing.set(type, new Set((await reader.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((row) => row.id)));
  }));
  const hasRequisites = events.some((event) => event.entityType === "REQUISITES" && event.entityId)
    ? (await tx.siteSetting.findMany({ where: { key: "requisites" }, select: { key: true } })).length > 0 : false;
  return events.map(({ entityId, ...event }) => {
    if (!entityId) return event;
    let href: string | null = null;
    if (event.entityType === "REQUISITES") href = hasRequisites ? "/admin/requisites" : null;
    else if (existing.get(event.entityType)?.has(entityId)) {
      const path = targets[event.entityType as keyof typeof targets][1];
      href = event.entityType === "DONATION" ? `${path}?donationId=${encodeURIComponent(entityId)}` : `${path}/${encodeURIComponent(entityId)}`;
    }
    return { ...event, href };
  });
}
