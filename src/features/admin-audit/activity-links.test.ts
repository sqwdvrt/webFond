import { describe, expect, it, vi } from "vitest";
import { resolveAuditLinks, type AuditEventWithEntity } from "./activity-links";

function event(entityId: string): AuditEventWithEntity {
  return { id: `audit-${entityId}`, entityId, entityType: "CONTACT_REQUEST", action: "CONTACT_FOLDER_CHANGED", previousStatus: "INBOX", nextStatus: "ARCHIVE", createdAt: new Date("2026-10-19T10:00:00Z") };
}
describe("audit object links", () => {
  it("resolves one batch per entity type and strips raw entity ids", async () => {
    const reader = { findMany: vi.fn(async () => []) };
    const contacts = { findMany: vi.fn(async () => [{ id: "available" }]) };
    const rows = await resolveAuditLinks([event("available"), event("missing")], { project: reader, newsPost: reader, document: reader, donation: reader, siteSetting: reader, contactRequest: contacts });
    expect(contacts.findMany).toHaveBeenCalledOnce();
    expect(contacts.findMany).toHaveBeenCalledWith({ where: { id: { in: ["available", "missing"] } }, select: { id: true } });
    expect(reader.findMany).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ href: "/admin/messages/available" });
    expect(rows[1]).toMatchObject({ href: null });
    expect(rows[0]).not.toHaveProperty("entityId");
  });
});
