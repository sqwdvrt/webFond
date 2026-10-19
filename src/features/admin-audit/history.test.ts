import { describe, expect, it, vi } from "vitest";
import { getAuditPage, parseAuditPage } from "./history";

describe("audit history", () => {
  it("rejects invalid or repeated page parameters", () => {
    expect(parseAuditPage(undefined)).toBe(1);
    for (const value of ["0", "1.5", "01", ["1", "2"], "99999999"]) expect(parseAuditPage(value)).toBeNull();
  });
  it("clamps pages and reads only safe audit fields in stable order", async () => {
    const reader = { findMany: vi.fn(async () => []) };
    const tx = { project: reader, newsPost: reader, document: reader, contactRequest: reader, donation: reader, siteSetting: reader, adminAuditEvent: { count: vi.fn(async () => 26), findMany: vi.fn(async () => []) } };
    const database = { $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => fn(tx) };
    const result = await getAuditPage(99, database);
    expect(result).toMatchObject({ page: 2, total: 26, totalPages: 2 });
    expect(tx.adminAuditEvent.findMany).toHaveBeenCalledWith({
      take: 25, skip: 25, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, action: true, entityType: true, entityId: true, previousStatus: true, nextStatus: true, createdAt: true },
    });
  });
});
