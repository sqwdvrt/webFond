import { describe, expect, it, vi } from "vitest";
import { checkDependencies } from "./dependencies";

const now = new Date("2026-11-17T18:00:00.000Z");
function database(value: unknown = null) {
  const transaction = { $executeRaw: vi.fn().mockResolvedValue(0), $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]), siteSetting: { findUnique: vi.fn().mockResolvedValue(value === null ? null : { value }) } };
  return { transaction, $transaction: vi.fn(async (run) => run(transaction)) };
}

describe("bounded dependency monitoring", () => {
  it("checks the database without reading payment heartbeat when payments are disabled", async () => {
    const db = database();
    expect(await checkDependencies(db, false, now)).toEqual({ ok: true, database: "ok", reconciliation: "disabled" });
    expect(db.transaction.siteSetting.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 1000, timeout: 3000 });
    expect(db.transaction.$executeRaw).toHaveBeenCalled();
  });
  it("accepts a fresh heartbeat at exactly 15 minutes", async () => {
    const db = database({ completedAt: "2026-11-17T17:45:00.000Z", failed: 0 });
    expect(await checkDependencies(db, true, now)).toEqual({ ok: true, database: "ok", reconciliation: "ok" });
  });
  it.each([null, { completedAt: "2026-11-17T17:44:59.999Z", failed: 0 }, { completedAt: "2026-11-17T18:01:00.000Z", failed: 0 }])("rejects missing, stale or invalid heartbeat %j", async value => {
    expect((await checkDependencies(database(value), true, now)).reconciliation).toBe("stale");
  });
  it("reports failed reconciliation even if its heartbeat is fresh", async () => {
    expect(await checkDependencies(database({ completedAt: now.toISOString(), failed: 1 }), true, now)).toEqual({ ok: false, database: "ok", reconciliation: "failed" });
  });
  it("does not expose database details on timeout or rejection", async () => {
    const db = database(); db.$transaction.mockRejectedValue(new Error("postgresql://secret"));
    expect(await checkDependencies(db, true, now)).toEqual({ ok: false, database: "unavailable", reconciliation: "unknown" });
  });
});
