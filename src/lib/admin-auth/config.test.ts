import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const configPath = resolve(process.cwd(), "src/lib/admin-auth/config.ts");

async function loadConfigModule() {
  expect(existsSync(configPath)).toBe(true);
  const modulePath = "./config";
  return import(/* @vite-ignore */ modulePath) as Promise<
    typeof import("./config")
  >;
}

const validEnv = {
  ADMIN_USERNAME: " admin ",
  ADMIN_PASSWORD: " fixture-passphrase-9087 ",
  AUTH_SECRET: ` ${"s".repeat(32)} `,
  ADMIN_TRUST_PROXY: "false",
};

describe("admin auth configuration", () => {
  it("returns normalized server configuration", async () => {
    const { readAdminAuthConfig } = await loadConfigModule();

    expect(readAdminAuthConfig(validEnv)).toEqual({
      username: "admin",
      password: " fixture-passphrase-9087 ",
      secret: "s".repeat(32),
      trustProxy: false,
    });
  });

  it.each(["ADMIN_USERNAME", "ADMIN_PASSWORD", "AUTH_SECRET"] as const)(
    "rejects a missing or blank %s without exposing values",
    async (name) => {
      const { AdminAuthConfigurationError, readAdminAuthConfig } =
        await loadConfigModule();
      const env = { ...validEnv, [name]: "   " };

      expect(() => readAdminAuthConfig(env)).toThrow(
        new AdminAuthConfigurationError(name),
      );
      expect(() => readAdminAuthConfig(env)).not.toThrow(
        /fixture-passphrase-9087/,
      );
    },
  );

  it("requires at least 32 characters in AUTH_SECRET", async () => {
    const { AdminAuthConfigurationError, readAdminAuthConfig } =
      await loadConfigModule();

    expect(() =>
      readAdminAuthConfig({ ...validEnv, AUTH_SECRET: "too-short" }),
    ).toThrow(new AdminAuthConfigurationError("AUTH_SECRET"));
  });

  it.each([undefined, "TRUE", "yes", ""])(
    "rejects invalid ADMIN_TRUST_PROXY value %s",
    async (value) => {
      const { AdminAuthConfigurationError, readAdminAuthConfig } =
        await loadConfigModule();

      expect(() =>
        readAdminAuthConfig({ ...validEnv, ADMIN_TRUST_PROXY: value }),
      ).toThrow(new AdminAuthConfigurationError("ADMIN_TRUST_PROXY"));
    },
  );

  it("accepts explicit proxy trust", async () => {
    const { readAdminAuthConfig } = await loadConfigModule();

    expect(
      readAdminAuthConfig({ ...validEnv, ADMIN_TRUST_PROXY: "true" })
        .trustProxy,
    ).toBe(true);
  });

  it("keeps the committed example configuration non-deployable", async () => {
    const { readAdminAuthConfig } = await loadConfigModule();
    const source = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    const exampleEnv = Object.fromEntries(
      source
        .split("\n")
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const [name, ...parts] = line.split("=");
          return [name, parts.join("=").replace(/^"|"$/g, "")];
        }),
    );

    expect(() => readAdminAuthConfig(exampleEnv)).toThrow();
  });
});
