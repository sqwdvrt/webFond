import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  redirect: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin-auth/session", () => ({
  getAdminSession: mocks.getAdminSession,
  requireAdminSession: mocks.requireAdminSession,
  setAdminSession: vi.fn(),
}));

import ProtectedAdminLayout from "./(protected)/layout";
import AdminLoginPage from "./login/page";

describe("admin route boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminSession.mockResolvedValue(null);
    mocks.requireAdminSession.mockResolvedValue({
      username: "fixture-operator",
    });
  });

  it("executes the session guard before rendering protected content", async () => {
    const denied = new Error("guest denied");
    mocks.requireAdminSession.mockRejectedValue(denied);

    await expect(
      ProtectedAdminLayout({ children: <p>Protected content</p> }),
    ).rejects.toBe(denied);
    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
  });

  it("renders protected content for an active session", async () => {
    const children = <p>Protected content</p>;

    expect(await ProtectedAdminLayout({ children })).toBe(children);
    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
  });

  it("redirects an active session away from the login page", async () => {
    const redirected = new Error("redirected");
    mocks.getAdminSession.mockResolvedValue({ username: "fixture-operator" });
    mocks.redirect.mockImplementation(() => {
      throw redirected;
    });

    await expect(AdminLoginPage()).rejects.toBe(redirected);
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it("renders the login form for a guest", async () => {
    const page = await AdminLoginPage();

    expect(page.type.name).toBe("LoginForm");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
