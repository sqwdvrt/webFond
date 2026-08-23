import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AdminAuthConfig } from "@/lib/admin-auth/config";
import { AdminAuthConfigurationError } from "@/lib/admin-auth/config";
import { LoginAttemptLimiter } from "@/lib/admin-auth/rate-limit";

const files = {
  actions: resolve(process.cwd(), "src/app/admin/login/actions.ts"),
  layout: resolve(process.cwd(), "src/app/admin/layout.tsx"),
  login: resolve(process.cwd(), "src/app/admin/login/page.tsx"),
  protectedLayout: resolve(
    process.cwd(),
    "src/app/admin/(protected)/layout.tsx",
  ),
  dashboard: resolve(process.cwd(), "src/app/admin/(protected)/page.tsx"),
  logout: resolve(process.cwd(), "src/app/admin/(protected)/actions.ts"),
};

async function loadLoginActions() {
  expect(existsSync(files.actions)).toBe(true);
  const importPath = "./login/actions";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./login/actions")
  >;
}

async function loadLogoutActions() {
  expect(existsSync(files.logout)).toBe(true);
  const importPath = "./(protected)/actions";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./(protected)/actions")
  >;
}

const config: AdminAuthConfig = {
  username: "admin",
  password: "admin12345",
  secret: "s".repeat(32),
  trustProxy: false,
};

function formData(username: string, password: string) {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    readConfig: () => config,
    readHeaders: async () => new Headers(),
    limiter: new LoginAttemptLimiter(),
    setSession: vi.fn(async () => undefined),
    now: () => 100,
    environment: "test",
    ...overrides,
  };
}

describe("admin auth flow", () => {
  it("defines the login and protected route boundaries", () => {
    expect(existsSync(files.layout)).toBe(true);
    expect(existsSync(files.login)).toBe(true);
    expect(existsSync(files.protectedLayout)).toBe(true);
    expect(existsSync(files.dashboard)).toBe(true);
  });

  it("rejects empty fields before reading configuration", async () => {
    const { performLogin } = await loadLoginActions();
    const readConfig = vi.fn(() => config);

    const result = await performLogin(
      formData("", ""),
      dependencies({ readConfig }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Введите логин и пароль",
    });
    expect(readConfig).not.toHaveBeenCalled();
  });

  it("returns the same neutral error for wrong credentials", async () => {
    const { performLogin } = await loadLoginActions();
    const deps = dependencies();

    const result = await performLogin(formData("admin", "wrong"), deps);

    expect(result).toEqual({
      status: "error",
      message: "Неверный логин или пароль",
    });
    expect(deps.setSession).not.toHaveBeenCalled();
  });

  it("blocks the sixth attempt after five failures", async () => {
    const { performLogin } = await loadLoginActions();
    const deps = dependencies();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await performLogin(formData("admin", "wrong"), deps);
    }

    expect(await performLogin(formData("admin", "wrong"), deps)).toEqual({
      status: "error",
      message: "Вход временно недоступен. Попробуйте позже",
    });
  });

  it("creates a session for valid credentials", async () => {
    const { performLogin } = await loadLoginActions();
    const deps = dependencies();

    const result = await performLogin(
      formData("admin", "admin12345"),
      deps,
    );

    expect(result).toEqual({ status: "success" });
    expect(deps.setSession).toHaveBeenCalledWith("admin");
  });

  it("maps invalid server configuration to a safe error", async () => {
    const { performLogin } = await loadLoginActions();
    const deps = dependencies({
      readConfig: () => {
        throw new AdminAuthConfigurationError("AUTH_SECRET");
      },
    });

    expect(
      await performLogin(formData("admin", "admin12345"), deps),
    ).toEqual({
      status: "error",
      message: "Вход временно недоступен. Попробуйте позже",
    });
  });

  it("clears the cookie before logout redirects", async () => {
    const { performLogout } = await loadLogoutActions();
    const clearSession = vi.fn(async () => undefined);
    const navigate = vi.fn((path: string): never => {
      throw new Error(`redirect:${path}`);
    });

    await expect(performLogout({ clearSession, navigate })).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(clearSession).toHaveBeenCalledOnce();
  });

  it("keeps the entire admin tree out of search indexes", async () => {
    expect(existsSync(files.layout)).toBe(true);
    const importPath = "./layout";
    const { metadata } = (await import(
      /* @vite-ignore */ importPath
    )) as typeof import("./layout");

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
