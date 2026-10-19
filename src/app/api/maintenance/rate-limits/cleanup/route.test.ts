import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cleanup: vi.fn() }));
vi.mock("@/features/maintenance/rate-limit-cleanup", () => ({ cleanupRateLimitBuckets: mocks.cleanup }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { POST } from "./route";
const secret = "maintenance-test-secret-at-least-32-characters";
function request(value: string | null = secret, body?: string, query = "") {
  return new Request(`https://example.org/api/maintenance/rate-limits/cleanup${query}`, { method: "POST", headers: value === null ? {} : { "x-maintenance-secret": value }, body });
}
describe("rate limit maintenance endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MAINTENANCE_SECRET", secret);
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    mocks.cleanup.mockResolvedValue({ deleted: 1000, batchFull: true });
  });
  it.each([undefined, "", "short", " ".repeat(32), ` ${secret}`])("fails closed for malformed server configuration %s", async (config) => {
    vi.stubEnv("MAINTENANCE_SECRET", config);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it.each([null, "wrong", "x".repeat(secret.length)])("rejects invalid caller secret before reading body", async (value) => {
    const input = request(value, "nonempty");
    const read = vi.spyOn(input.body!, "getReader");
    expect((await POST(input)).status).toBe(401);
    expect(read).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("runs with payments disabled and protects responses", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 1000, batchFull: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
  it("accepts an empty HTTP body stream created by the Next.js request adapter", async () => {
    const input = request();
    Object.defineProperty(input, "body", { value: new ReadableStream({ start(controller) { controller.close(); } }) });
    expect((await POST(input)).status).toBe(200);
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
  it.each(["{}", " ", "x".repeat(10000)])("rejects nonempty bodies", async (body) => {
    expect((await POST(request(secret, body))).status).toBe(400);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("rejects query controls", async () => {
    expect((await POST(request(secret, undefined, "?limit=5000"))).status).toBe(400);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("returns 503 without exposing database errors", async () => {
    mocks.cleanup.mockRejectedValue(new Error("sensitive database detail"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
});
