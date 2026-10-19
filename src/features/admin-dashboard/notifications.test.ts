import { describe, expect, it, vi } from "vitest";
import { loadAdminNotifications } from "./notifications";

function dependencies(paymentsEnabled = true) {
  const tx = {
    contactRequest: { count: vi.fn().mockResolvedValue(2) },
    donation: { count: vi.fn().mockResolvedValue(3) },
    siteSetting: { findUnique: vi.fn<() => Promise<{ value: unknown } | null>>().mockResolvedValue(null) },
  };
  const database = {
    async $transaction<Result>(callback: (client: typeof tx) => Promise<Result>) {
      return callback(tx);
    },
  };
  vi.spyOn(database, "$transaction");
  return {
    tx,
    database,
    evaluateReadiness: () => ({ issues: [] }),
    paymentsEnabled: () => paymentsEnabled,
  };
}

const now = new Date("2026-10-20T09:00:00.000Z");

describe("admin notifications read model", () => {
  it("loads only warning data with matching stale inbox and donation filters", async () => {
    const deps = dependencies();
    const model = await loadAdminNotifications(now, deps);
    expect(model.alerts.map((alert) => alert.code)).toEqual([
      "STALE_PENDING_DONATIONS", "PAYMENTS_RECONCILIATION_STALE", "STALE_NEW_CONTACTS",
    ]);
    expect(deps.tx.contactRequest.count).toHaveBeenCalledWith({ where: { status: "NEW", folder: "INBOX", createdAt: { lt: new Date("2026-10-18T09:00:00.000Z") } } });
    expect(deps.tx.donation.count).toHaveBeenCalledWith({ where: { status: "PENDING", createdAt: { lt: new Date("2026-10-20T08:00:00.000Z") } } });
    expect(deps.database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });

  it("omits reconciliation data when payments are disabled", async () => {
    const deps = dependencies(false);
    const model = await loadAdminNotifications(now, deps);
    expect(deps.tx.siteSetting.findUnique).not.toHaveBeenCalled();
    expect(model.reconciliation).toBeUndefined();
    expect(model.alerts.some((alert) => alert.code === "PAYMENTS_RECONCILIATION_STALE")).toBe(false);
  });

  it("clears the active warning count when causes are resolved", async () => {
    const deps = dependencies();
    deps.tx.contactRequest.count.mockResolvedValue(0);
    deps.tx.donation.count.mockResolvedValue(0);
    deps.tx.siteSetting.findUnique.mockResolvedValue({ value: { completedAt: now.toISOString(), failed: 0 } });
    expect((await loadAdminNotifications(now, deps)).alerts).toEqual([]);
  });
});
