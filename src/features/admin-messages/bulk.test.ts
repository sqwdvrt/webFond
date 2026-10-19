import { describe, expect, it, vi } from "vitest";
import { parseContactSelection, moveContactSelection } from "./bulk";

function selectionForm() {
  const data = new FormData();
  data.set("folder", "INBOX"); data.set("intent", "archive");
  data.append("selection", JSON.stringify({ id: "contact-1", updatedAt: "2026-10-19T10:00:00.000Z" }));
  return data;
}

describe("bulk contact moves", () => {
  it("validates bounded unique selections, folders, intents and canonical versions", () => {
    expect(parseContactSelection(selectionForm())).toMatchObject({ source: "INBOX", target: "ARCHIVE", rows: [{ id: "contact-1", updatedAt: new Date("2026-10-19T10:00:00.000Z") }] });
    const empty = selectionForm(); empty.delete("selection"); expect(parseContactSelection(empty)).toBeNull();
    const duplicate = selectionForm(); duplicate.append("selection", duplicate.get("selection")!); expect(parseContactSelection(duplicate)).toBeNull();
    const malformed = selectionForm(); malformed.set("selection", "{}"); expect(parseContactSelection(malformed)).toBeNull();
    const invalid = selectionForm(); invalid.set("folder", "BAD"); expect(parseContactSelection(invalid)).toBeNull();
    const repeated = selectionForm(); repeated.append("intent", "trash"); expect(parseContactSelection(repeated)).toBeNull();
  });
  it("uses version and source-folder checks and writes only safe audit data", async () => {
    const tx = { contactRequest: { updateMany: vi.fn(async () => ({ count: 1 })) }, adminAuditEvent: { createMany: vi.fn(async () => ({})) } };
    const database = { $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => fn(tx) };
    await moveContactSelection(parseContactSelection(selectionForm())!, database);
    expect(tx.contactRequest.updateMany).toHaveBeenCalledWith({ where: { id: "contact-1", updatedAt: new Date("2026-10-19T10:00:00.000Z"), folder: "INBOX" }, data: { folder: "ARCHIVE" } });
    expect(tx.adminAuditEvent.createMany).toHaveBeenCalledWith({ data: [{ actorKind: "ADMIN", action: "CONTACT_FOLDER_CHANGED", entityType: "CONTACT_REQUEST", entityId: "contact-1", previousStatus: "INBOX", nextStatus: "ARCHIVE" }] });
  });
  it("throws inside the transaction on conflict before auditing", async () => {
    const tx = { contactRequest: { updateMany: vi.fn(async () => ({ count: 0 })) }, adminAuditEvent: { createMany: vi.fn() } };
    const database = { $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => fn(tx) };
    await expect(moveContactSelection(parseContactSelection(selectionForm())!, database)).rejects.toThrow("contact_selection_conflict");
    expect(tx.adminAuditEvent.createMany).not.toHaveBeenCalled();
  });
});
