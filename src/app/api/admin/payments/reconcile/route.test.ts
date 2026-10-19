import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), batch: vi.fn(), single: vi.fn(), quota: vi.fn() }));
vi.mock("@/lib/admin-auth/session", () => ({ getAdminSession: mocks.session }));
vi.mock("@/features/payments/reconcile-pending", () => ({ reconcilePendingPayments: mocks.batch, reconcileSinglePayment: mocks.single }));
vi.mock("@/features/payments/repository", () => ({ paymentRepository: {}, consumeReconciliationQuota: mocks.quota }));
vi.mock("@/features/payments/config", () => ({ readYooKassaConfig: () => ({}) }));
vi.mock("@/features/payments/yookassa-client", () => ({ createYooKassaClient: () => ({}) }));
import { POST } from "./route";
function request(body: unknown) { return new Request("https://example.org/api/admin/payments/reconcile", { method: "POST", body: JSON.stringify(body) }); }
describe("admin payment checks", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ username: "admin" }); mocks.quota.mockResolvedValue(undefined); mocks.single.mockResolvedValue({ kind: "succeeded" }); mocks.batch.mockResolvedValue({ succeeded: 0, canceled: 0, pending: 0, failed: 0, skipped: 0 }); });
  it("rejects guests before touching the payment provider", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ mode: "single", donationId: "donation-1" }))).status).toBe(401);
    expect(mocks.single).not.toHaveBeenCalled();
  });
  it.each([null, [], { limit: 1.5 }, { limit: 200 }])("rejects invalid input %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("checks the selected local donation and returns a safe outcome", async () => {
    const response = await POST(request({ mode: "single", donationId: "donation-1" }));
    expect(response.status).toBe(200);
    expect(mocks.single).toHaveBeenCalledWith(expect.objectContaining({ donationId: "donation-1" }));
    expect(await response.json()).toEqual({ kind: "succeeded" });
  });
  it("distinguishes busy, missing, and unavailable payments", async () => {
    for (const [kind, status] of [["busy", 409], ["not-found", 404], ["unbound", 422]] as const) {
      mocks.single.mockResolvedValue({ kind });
      expect((await POST(request({ mode: "single", donationId: "donation-1" }))).status).toBe(status);
    }
  });
});
