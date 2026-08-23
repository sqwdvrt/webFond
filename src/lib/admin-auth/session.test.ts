import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AdminAuthConfig } from "./config";

const modulePath = resolve(process.cwd(), "src/lib/admin-auth/session.ts");
const config: AdminAuthConfig = {
  username: "admin",
  password: "fixture-passphrase-9087",
  secret: "s".repeat(32),
  trustProxy: false,
};

async function loadSessionModule() {
  expect(existsSync(modulePath)).toBe(true);
  const importPath = "./session";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./session")
  >;
}

describe("admin session cookie adapter", () => {
  it("writes a secure eight-hour production cookie", async () => {
    const { ADMIN_SESSION_COOKIE, writeAdminSessionToStore } =
      await loadSessionModule();
    const store = { set: vi.fn() };

    const payload = writeAdminSessionToStore({
      store,
      config,
      now: 100,
      environment: "production",
    });

    expect(payload.username).toBe("admin");
    expect(store.set).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      expect.any(String),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        maxAge: 8 * 60 * 60,
        expires: new Date(payload.expiresAt * 1_000),
      },
    );
  });

  it("does not mark local HTTP cookies as secure", async () => {
    const { writeAdminSessionToStore } = await loadSessionModule();
    const store = { set: vi.fn() };

    writeAdminSessionToStore({
      store,
      config,
      now: 100,
      environment: "development",
    });

    expect(store.set.mock.calls[0][2]).toMatchObject({ secure: false });
  });

  it("reads valid cookies and rejects invalid or expired cookies", async () => {
    const {
      ADMIN_SESSION_COOKIE,
      readAdminSessionFromStore,
      writeAdminSessionToStore,
    } = await loadSessionModule();
    let token = "";
    const writer = {
      set: vi.fn((name: string, value: string) => {
        if (name === ADMIN_SESSION_COOKIE) token = value;
      }),
    };
    const created = writeAdminSessionToStore({
      store: writer,
      config,
      now: 100,
      environment: "test",
    });

    expect(
      readAdminSessionFromStore({
        store: { get: () => ({ value: token }) },
        config,
        now: 101,
      }),
    ).toEqual(created);
    expect(
      readAdminSessionFromStore({
        store: { get: () => ({ value: `${token}tampered` }) },
        config,
        now: 101,
      }),
    ).toBeNull();
    expect(
      readAdminSessionFromStore({
        store: { get: () => ({ value: token }) },
        config,
        now: created.expiresAt,
      }),
    ).toBeNull();
  });

  it("returns null when the session cookie is absent", async () => {
    const { readAdminSessionFromStore } = await loadSessionModule();

    expect(
      readAdminSessionFromStore({
        store: { get: () => undefined },
        config,
        now: 100,
      }),
    ).toBeNull();
  });

  it("deletes the named admin cookie", async () => {
    const { ADMIN_SESSION_COOKIE, clearAdminSessionFromStore } =
      await loadSessionModule();
    const store = { delete: vi.fn() };

    clearAdminSessionFromStore(store);

    expect(store.delete).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE);
  });
});
