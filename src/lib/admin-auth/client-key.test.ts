import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modulePath = resolve(process.cwd(), "src/lib/admin-auth/client-key.ts");
const secret = "s".repeat(32);

async function loadClientKeyModule() {
  expect(existsSync(modulePath)).toBe(true);
  const importPath = "./client-key";
  return import(/* @vite-ignore */ importPath) as Promise<
    typeof import("./client-key")
  >;
}

describe("createClientKey", () => {
  it("uses one shared local source outside production", async () => {
    const { createClientKey } = await loadClientKeyModule();
    const first = createClientKey({
      headers: new Headers({ "x-forwarded-for": "192.0.2.1" }),
      secret,
      trustProxy: true,
      environment: "development",
    });
    const second = createClientKey({
      headers: new Headers({ "x-real-ip": "198.51.100.4" }),
      secret,
      trustProxy: false,
      environment: "test",
    });

    expect(first).toBe(second);
  });

  it("uses the first forwarded address behind an explicitly trusted proxy", async () => {
    const { createClientKey } = await loadClientKeyModule();
    const forwarded = createClientKey({
      headers: new Headers({
        "x-forwarded-for": "192.0.2.1, 198.51.100.4",
      }),
      secret,
      trustProxy: true,
      environment: "production",
    });
    const direct = createClientKey({
      headers: new Headers({ "x-forwarded-for": "192.0.2.1" }),
      secret,
      trustProxy: true,
      environment: "production",
    });

    expect(forwarded).toBe(direct);
    expect(forwarded).not.toContain("192.0.2.1");
  });

  it("falls back to x-real-ip behind a trusted proxy", async () => {
    const { createClientKey } = await loadClientKeyModule();
    const realIp = createClientKey({
      headers: new Headers({ "x-real-ip": "198.51.100.4" }),
      secret,
      trustProxy: true,
      environment: "production",
    });
    const forwarded = createClientKey({
      headers: new Headers({ "x-forwarded-for": "198.51.100.4" }),
      secret,
      trustProxy: true,
      environment: "production",
    });

    expect(realIp).toBe(forwarded);
  });

  it("ignores forwarding headers unless proxy trust is explicit", async () => {
    const { createClientKey } = await loadClientKeyModule();
    const untrusted = createClientKey({
      headers: new Headers({ "x-forwarded-for": "192.0.2.1" }),
      secret,
      trustProxy: false,
      environment: "production",
    });
    const unknown = createClientKey({
      headers: new Headers(),
      secret,
      trustProxy: true,
      environment: "production",
    });

    expect(untrusted).toBe(unknown);
    expect(untrusted).toMatch(/^[a-f0-9]{64}$/);
  });
});
