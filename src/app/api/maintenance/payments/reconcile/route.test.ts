import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcile: vi.fn(),
  readConfig: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/features/payments/reconcile-pending", () => ({
  reconcilePendingPayments: mocks.reconcile,
}));
vi.mock("@/features/payments/config", () => ({
  readYooKassaConfig: mocks.readConfig,
}));
vi.mock("@/features/payments/yookassa-client", () => ({
  createYooKassaClient: mocks.createClient,
}));
vi.mock("@/features/payments/repository", () => ({ paymentRepository: {} }));

import { POST } from "./route";

describe("maintenance payment reconciliation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENTS_RECONCILE_SECRET = "secret-123";
    mocks.reconcile.mockResolvedValue({ succeeded: 1, canceled: 0, pending: 0, failed: 0, skipped: 0 });
  });

  it("rejects an invalid scheduler secret", async () => {
    const response = await POST(new Request("https://example.org/api/maintenance/payments/reconcile", {
      method: "POST",
      headers: { "x-reconcile-secret": "wrong" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs a bounded reconciliation with a valid scheduler secret", async () => {
    const response = await POST(new Request("https://example.org/api/maintenance/payments/reconcile", {
      method: "POST",
      headers: { "x-reconcile-secret": "secret-123", "content-type": "application/json" },
      body: JSON.stringify({ limit: 10 }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ succeeded: 1 });
  });
});
