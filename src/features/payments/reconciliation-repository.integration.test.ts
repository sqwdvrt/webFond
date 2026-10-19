import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPaymentRepository } from "./repository";
import { requireSafePaymentsTestDatabaseUrl } from "./test-database-url";
import { reconcileSinglePayment } from "./reconcile-pending";
import { createYooKassaClient } from "./yookassa-client";

const client = new PrismaClient({ datasources: { db: { url: requireSafePaymentsTestDatabaseUrl() } } });
const repository = createPaymentRepository(client);
const prefix = "reconciliation-integration-";
const now = new Date("2026-10-19T00:00:00Z");
const selection = { now, limit: 25, maxAttempts: 8, createdAfter: new Date("2026-07-21"), createdBefore: new Date("2026-10-18") };
const clean = async () => {
  await client.adminAuditEvent.deleteMany({ where: { entityId: { startsWith: prefix } } });
  await client.donation.deleteMany({ where: { id: { startsWith: prefix } } });
};
beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await client.$disconnect(); });

describe("reconciliation queue with PostgreSQL", () => {
  it("processes an eligible row behind a backlog larger than cleanup batch", async () => {
    await client.donation.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ id: `${prefix}${i}`, idempotenceKey: `${prefix}${i}`, providerPaymentId: `${prefix}${i}`, amountKopecks: 10000, reconcileAttempts: 8, createdAt: new Date("2026-08-01") })) });
    await client.donation.create({ data: { id: `${prefix}eligible`, idempotenceKey: `${prefix}eligible`, providerPaymentId: `${prefix}eligible`, amountKopecks: 10000, createdAt: new Date("2026-09-01") } });
    await repository.retireReconciliationCandidates(selection);
    const rows = await repository.listPendingForReconciliation(selection);
    expect(rows.some((row) => row.id === `${prefix}eligible`)).toBe(true);
    expect(rows.every((row) => row.reconcileAttempts < 8)).toBe(true);
  });
  it("allows one worker, reclaims an expired lease, and ignores stale release", async () => {
    const id = `${prefix}eligible`;
    const claims = await Promise.all([repository.claimForReconciliation(id, "a", new Date(now.getTime() + 60000), now), repository.claimForReconciliation(id, "b", new Date(now.getTime() + 60000), now)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const later = new Date(now.getTime() + 61000);
    expect(await repository.claimForReconciliation(id, "c", new Date(later.getTime() + 60000), later)).toBe(true);
    await repository.releaseReconciliation(id, "a");
    expect((await repository.findById(id))?.claimToken).toBe("c");
    await repository.releaseReconciliation(id, "c");
  });
  it("claims and audits a manual retry atomically and never overwrites a terminal status", async () => {
    const id = `${prefix}eligible`;
    expect(await repository.claimManualReconciliation(id, "manual", new Date(now.getTime() + 60000), now)).toBe(true);
    expect(await client.adminAuditEvent.count({ where: { entityId: id, action: "PAYMENT_RECONCILE_REQUESTED" } })).toBe(1);
    await client.donation.update({ where: { id }, data: { status: "CANCELED" } });
    expect((await repository.transitionPending(id, "SUCCEEDED", now)).status).toBe("CANCELED");
  });

  it.each([
    ["succeeded", undefined], ["succeeded", "sberbank"],
    ["succeeded", "future_method"], ["canceled", undefined],
  ] as const)("recovers manual review from verified API status %s and method %s", async (status, method) => {
    const id = `${prefix}recovery-${status}-${method ?? "missing"}`;
    await client.donation.create({ data: {
      id, idempotenceKey: id, providerPaymentId: id, amountKopecks: 10000,
      manualReviewRequired: true, reconcileAttempts: 8,
      lastReconcileErrorCode: "payment_method_mismatch",
      createdAt: new Date("2026-09-01"),
    } });
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
      id, status, paid: status === "succeeded", amount: { value: "100.00", currency: "RUB" },
      metadata: { donationId: id },
      ...(status === "succeeded" ? { captured_at: now.toISOString() } : {}),
      ...(method ? { payment_method: { type: method } } : {}),
    }));
    const provider = createYooKassaClient({ shopId: "test-shop", secretKey: "test-key" }, { fetch });
    expect(await reconcileSinglePayment({ repository, client: provider, donationId: id, now })).toEqual({ kind: status });
    expect(await repository.findById(id)).toMatchObject({
      status: status === "succeeded" ? "SUCCEEDED" : "CANCELED",
      paidAt: status === "succeeded" ? now : null,
      lastProviderStatus: status, lastReconcileErrorCode: null,
      manualReviewRequired: false, nextReconcileAt: null, claimToken: null,
    });
    expect(await client.adminAuditEvent.count({ where: { entityId: id, action: "PAYMENT_RECONCILE_REQUESTED" } })).toBe(1);
    expect(await reconcileSinglePayment({ repository, client: provider, donationId: id, now })).toEqual({ kind: "already-terminal" });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
