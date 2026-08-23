import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { AdminAuthConfig } from "./config";

const modulePath = resolve(process.cwd(), "src/lib/admin-auth/credentials.ts");

async function loadCredentialsModule() {
  expect(existsSync(modulePath)).toBe(true);
  const importPath = "./credentials";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./credentials")
  >;
}

const config: AdminAuthConfig = {
  username: "admin",
  password: "admin12345",
  secret: "s".repeat(32),
  trustProxy: false,
};

describe("credentialsMatch", () => {
  it("accepts only the configured credentials", async () => {
    const { credentialsMatch } = await loadCredentialsModule();

    expect(
      credentialsMatch({ username: "admin", password: "admin12345", config }),
    ).toBe(true);
    expect(
      credentialsMatch({ username: "editor", password: "admin12345", config }),
    ).toBe(false);
    expect(
      credentialsMatch({ username: "admin", password: "wrong", config }),
    ).toBe(false);
  });

  it("handles values with different byte lengths", async () => {
    const { credentialsMatch } = await loadCredentialsModule();

    expect(
      credentialsMatch({ username: "a", password: "x".repeat(200), config }),
    ).toBe(false);
  });
});
