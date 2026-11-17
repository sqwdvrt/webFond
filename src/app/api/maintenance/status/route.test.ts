import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ check: vi.fn(), enabled: vi.fn() }));
vi.mock("@/features/readiness/dependencies", () => ({ checkDependencies: mocks.check }));
vi.mock("@/features/payments/config", () => ({ readPaymentsAvailability: mocks.enabled }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { GET } from "./route";
const secret = "test-maintenance-secret-32-characters";
const request = (value = secret, query = "") => new Request(`https://example.org/api/maintenance/status${query}`, { headers: { "x-maintenance-secret": value } });
let testNumber = 0;
describe("private dependency status", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(Date.parse("2026-11-17T18:00:00Z") + ++testNumber * 60000)); vi.stubEnv("MAINTENANCE_SECRET", secret); mocks.enabled.mockReturnValue({ enabled: false }); mocks.check.mockResolvedValue({ ok: true, database: "ok", reconciliation: "disabled" }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it("rejects guests before accessing dependencies", async () => {
    expect((await GET(request("wrong"))).status).toBe(401); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("fails closed for invalid configuration", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", "short"); expect((await GET(request())).status).toBe(503); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("rejects query parameters including secrets", async () => {
    expect((await GET(request(secret, "?secret=anything"))).status).toBe(400); expect(mocks.check).not.toHaveBeenCalled();
  });
  it("limits authenticated polling per process and uses private headers", async () => {
    const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const second = await GET(request()); expect(second.status).toBe(429); expect(second.headers.get("retry-after")).toBe("5"); expect(mocks.check).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000); expect((await GET(request())).status).toBe(200);
  });
  it("returns safe unavailable status for thrown checks", async () => {
    mocks.check.mockRejectedValue(new Error("private-detail")); const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-detail");
  });
  it("returns 503 for a failed dependency", async () => {
    mocks.check.mockResolvedValue({ ok: false, database: "ok", reconciliation: "stale" }); const response = await GET(request()); expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, database: "ok", reconciliation: "stale" });
  });
});
