import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  readAdminAuthConfig: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return { ...actual, readAdminAuthConfig: mocks.readAdminAuthConfig };
});

import { requireAdminSession } from "./session";

describe("requireAdminSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAdminAuthConfig.mockReturnValue({
      username: "fixture-operator",
      password: "fixture-passphrase-9087",
      secret: "s".repeat(32),
      trustProxy: false,
    });
    mocks.cookies.mockResolvedValue({ get: () => undefined });
  });

  it("redirects a guest to the admin login page", async () => {
    const redirected = new Error("redirected");
    mocks.redirect.mockImplementation(() => {
      throw redirected;
    });

    await expect(requireAdminSession()).rejects.toBe(redirected);
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });
});
