import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  readAdminAuthConfig: vi.fn(),
  redirect: vi.fn(),
  setAdminSession: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin-auth/config", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/admin-auth/config")
  >();
  return { ...actual, readAdminAuthConfig: mocks.readAdminAuthConfig };
});
vi.mock("@/lib/admin-auth/session", () => ({
  setAdminSession: mocks.setAdminSession,
}));

import { loginAction } from "./actions";

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.readAdminAuthConfig.mockReturnValue({
      username: "fixture-operator",
      password: "fixture-passphrase-9087",
      secret: "s".repeat(32),
      trustProxy: false,
    });
    mocks.setAdminSession.mockResolvedValue(undefined);
  });

  it("sets a session and redirects after valid credentials", async () => {
    const redirected = new Error("redirected");
    mocks.redirect.mockImplementation(() => {
      throw redirected;
    });
    const data = new FormData();
    data.set("username", "fixture-operator");
    data.set("password", "fixture-passphrase-9087");

    await expect(
      loginAction({ status: "idle", message: "" }, data),
    ).rejects.toBe(redirected);
    expect(mocks.setAdminSession).toHaveBeenCalledWith("fixture-operator");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });
});
