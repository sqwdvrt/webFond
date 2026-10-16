import { describe, expect, it, vi } from "vitest";

import { AdminAuthConfigurationError } from "@/lib/admin-auth/config";

import { evaluateReadiness } from "./evaluate";

describe("evaluateReadiness", () => {
  it("reports readiness without returning configuration values", () => {
    const readConfig = vi.fn(() => ({
      username: "operator",
      password: "password-that-must-not-leak",
      secret: "secret-that-must-not-leak",
      trustProxy: false,
    }));

    expect(evaluateReadiness(readConfig)).toEqual({ ok: true, issues: [] });
    expect(readConfig).toHaveBeenCalledOnce();
  });

  it("maps an admin configuration error to one safe issue code", () => {
    const result = evaluateReadiness(() => {
      throw new AdminAuthConfigurationError("AUTH_SECRET");
    });

    expect(result).toEqual({ ok: false, issues: ["ADMIN_AUTH"] });
    expect(JSON.stringify(result)).not.toContain("AUTH_SECRET");
  });

  it("rethrows unexpected errors unchanged", () => {
    const error = new Error("unexpected failure");

    expect(() =>
      evaluateReadiness(() => {
        throw error;
      }),
    ).toThrow(error);
  });
});
