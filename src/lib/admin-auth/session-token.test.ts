import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modulePath = resolve(
  process.cwd(),
  "src/lib/admin-auth/session-token.ts",
);
const secret = "s".repeat(32);

async function loadSessionTokenModule() {
  expect(existsSync(modulePath)).toBe(true);
  const importPath = "./session-token";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./session-token")
  >;
}

describe("admin session token", () => {
  it("creates a verifiable eight-hour session", async () => {
    const { createSessionToken, verifySessionToken } =
      await loadSessionTokenModule();
    const created = createSessionToken({ username: "admin", secret, now: 100 });

    expect(created.payload).toEqual({
      version: 1,
      username: "admin",
      issuedAt: 100,
      expiresAt: 100 + 8 * 60 * 60,
    });
    expect(
      verifySessionToken({
        token: created.token,
        username: "admin",
        secret,
        now: 101,
      }),
    ).toEqual(created.payload);
  });

  it("rejects tampered payloads and signatures", async () => {
    const { createSessionToken, verifySessionToken } =
      await loadSessionTokenModule();
    const { token } = createSessionToken({ username: "admin", secret, now: 100 });
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        version: 1,
        username: "editor",
        issuedAt: 100,
        expiresAt: 1_000_000,
      }),
    ).toString("base64url");
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

    expect(
      verifySessionToken({
        token: `${tamperedPayload}.${signature}`,
        username: "admin",
        secret,
        now: 101,
      }),
    ).toBeNull();
    expect(
      verifySessionToken({
        token: `${payload}.${tamperedSignature}`,
        username: "admin",
        secret,
        now: 101,
      }),
    ).toBeNull();
  });

  it("rejects signatures with an invalid byte length", async () => {
    const { createSessionToken, verifySessionToken } =
      await loadSessionTokenModule();
    const { token } = createSessionToken({ username: "admin", secret, now: 100 });
    const [payload, signature] = token.split(".");

    for (const invalidSignature of [signature.slice(2), `${signature}AA`]) {
      expect(
        verifySessionToken({
          token: `${payload}.${invalidSignature}`,
          username: "admin",
          secret,
          now: 101,
        }),
      ).toBeNull();
    }
  });

  it("rejects the wrong secret, current username, and expired sessions", async () => {
    const { createSessionToken, verifySessionToken } =
      await loadSessionTokenModule();
    const created = createSessionToken({ username: "admin", secret, now: 100 });

    expect(
      verifySessionToken({
        token: created.token,
        username: "admin",
        secret: "x".repeat(32),
        now: 101,
      }),
    ).toBeNull();
    expect(
      verifySessionToken({
        token: created.token,
        username: "editor",
        secret,
        now: 101,
      }),
    ).toBeNull();
    expect(
      verifySessionToken({
        token: created.token,
        username: "admin",
        secret,
        now: created.payload.expiresAt,
      }),
    ).toBeNull();
  });

  it("rejects malformed and unsupported token formats", async () => {
    const { createSessionToken, verifySessionToken } =
      await loadSessionTokenModule();
    const created = createSessionToken({ username: "admin", secret, now: 100 });
    const [, signature] = created.token.split(".");
    const wrongVersion = Buffer.from(
      JSON.stringify({ ...created.payload, version: 2 }),
    ).toString("base64url");

    for (const token of [
      "not-a-token",
      `***.${signature}`,
      `${Buffer.from("not-json").toString("base64url")}.${signature}`,
      `${wrongVersion}.${signature}`,
      `${created.token}.extra`,
    ]) {
      expect(
        verifySessionToken({ token, username: "admin", secret, now: 101 }),
      ).toBeNull();
    }
  });
});
