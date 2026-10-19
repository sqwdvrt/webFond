import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CONTACT_FOLDERS, type ContactFolderValue } from "./types";

export type ContactSelection = {
  source: ContactFolderValue;
  target: ContactFolderValue;
  rows: Array<{ id: string; updatedAt: Date }>;
};
export type ContactBulkState = { status: "idle" | "error"; message: string };

function one(data: FormData, name: string) {
  const values = data.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

export function parseContactSelection(data: FormData): ContactSelection | null {
  const source = one(data, "folder") as ContactFolderValue;
  const intent = one(data, "intent");
  const target = intent === "archive" ? "ARCHIVE" : intent === "trash" ? "TRASH" : intent === "restore" ? "INBOX" : null;
  const selected = data.getAll("selection");
  if (!CONTACT_FOLDERS.includes(source) || !target || source === target || selected.length < 1 || selected.length > 25) return null;
  const rows: ContactSelection["rows"] = [];
  const ids = new Set<string>();
  for (const value of selected) {
    if (typeof value !== "string" || value.length > 512) return null;
    let row: unknown;
    try { row = JSON.parse(value); } catch { return null; }
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const { id, updatedAt } = row as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || ids.has(id)
      || typeof updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)
      || !Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) return null;
    ids.add(id);
    rows.push({ id, updatedAt: new Date(updatedAt) });
  }
  return { source, target, rows };
}

type BulkTransaction = {
  contactRequest: { updateMany(args: Prisma.ContactRequestUpdateManyArgs): Promise<{ count: number }> };
  adminAuditEvent: { createMany(args: Prisma.AdminAuditEventCreateManyArgs): Promise<unknown> };
};
type BulkDatabase = { $transaction<T>(callback: (tx: BulkTransaction) => Promise<T>): Promise<T> };

export class ContactSelectionConflict extends Error {
  constructor() { super("contact_selection_conflict"); }
}

export function moveContactSelection(input: ContactSelection, database: BulkDatabase = prisma) {
  return database.$transaction(async (tx) => {
    // Stable order prevents two bulk operations locking the same rows in opposite order.
    for (const row of [...input.rows].sort((a, b) => a.id.localeCompare(b.id))) {
      const result = await tx.contactRequest.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt, folder: input.source },
        data: { folder: input.target },
      });
      if (result.count !== 1) throw new ContactSelectionConflict();
    }
    await tx.adminAuditEvent.createMany({ data: input.rows.map((row) => ({
      actorKind: "ADMIN", action: "CONTACT_FOLDER_CHANGED", entityType: "CONTACT_REQUEST",
      entityId: row.id, previousStatus: input.source, nextStatus: input.target,
    })) });
  });
}
