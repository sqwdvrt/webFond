import { describe, expect, it, vi } from "vitest";

import {
  AdminAuthConfigurationError,
  readAdminAuthConfig,
} from "@/lib/admin-auth/config";

import { checkReadiness } from "./route";

describe("GET /api/ready", () => {
  it("reports ready after validating the injected admin configuration", async () => {
    const readConfig = vi.fn(() => ({
      username: "readiness-operator",
      password: "readiness-password",
      secret: "readiness-secret-that-must-not-leak",
      trustProxy: false,
    }));

    const response = checkReadiness(readConfig);
    const text = await response.text();

    expect(readConfig).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(text).not.toContain("readiness-operator");
    expect(text).not.toContain("readiness-password");
    expect(text).not.toContain("readiness-secret-that-must-not-leak");
  });

  it("reports a generic failure for invalid admin configuration", async () => {
    const suppliedSecret = "supplied-secret-that-must-not-leak";
    const readConfig = () =>
      readAdminAuthConfig({
        ADMIN_USERNAME: "operator",
        ADMIN_PASSWORD: "password",
        AUTH_SECRET: suppliedSecret,
        ADMIN_TRUST_PROXY: "invalid",
      });

    const response = checkReadiness(readConfig);
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ ok: false });
    expect(text).not.toContain("ADMIN_TRUST_PROXY");
    expect(text).not.toContain(suppliedSecret);
  });

  it("rethrows unexpected errors", () => {
    const error = new Error("unexpected failure");

    expect(() =>
      checkReadiness(() => {
        throw error;
      }),
    ).toThrow(error);
  });

  it("handles the configuration error class and no broader error type", async () => {
    const response = checkReadiness(() => {
      throw new AdminAuthConfigurationError("AUTH_SECRET");
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
