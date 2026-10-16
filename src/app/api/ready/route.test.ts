import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./route";

describe("GET /api/ready", () => {
  it("reports ready after consuming the injected readiness evaluator", async () => {
    const evaluate = vi.fn(() => ({ ok: true as const, issues: [] as [] }));

    const response = checkReadiness(evaluate);
    const text = await response.text();

    expect(evaluate).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(text)).toEqual({ ok: true });
  });

  it("reports a generic failure for readiness issues", async () => {
    const response = checkReadiness(() => ({
      ok: false,
      issues: ["ADMIN_AUTH"],
    }));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(text)).toEqual({ ok: false });
    expect(text).not.toContain("ADMIN_AUTH");
  });

  it("rethrows unexpected errors", () => {
    const error = new Error("unexpected failure");

    expect(() =>
      checkReadiness(() => {
        throw error;
      }),
    ).toThrow(error);
  });
});
