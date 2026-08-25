import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Vercel release files", () => {
  it("generates Prisma Client on install and migrates during the Vercel build", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      engines?: { node?: string };
      scripts?: Record<string, string>;
    };
    const vercelJson = JSON.parse(read("vercel.json")) as {
      buildCommand?: string;
      framework?: string;
    };

    expect(packageJson.engines?.node).toBe(">=20.9.0");
    expect(packageJson.scripts?.postinstall).toBe("prisma generate");
    expect(packageJson.scripts?.build).toBe("next build");
    expect(packageJson.scripts?.["vercel-build"]).toBe(
      "prisma generate && prisma migrate deploy && next build",
    );
    expect(vercelJson.framework).toBe("nextjs");
    expect(vercelJson.buildCommand).toBe("npm run vercel-build");
  });

  it("documents Neon pooled and unpooled URLs without committing secrets", () => {
    const envExample = read(".env.example");
    const gitignore = read(".gitignore");
    const readme = read("README.md");

    expect(envExample).toContain("DATABASE_URL=");
    expect(envExample).toContain("DATABASE_URL_UNPOOLED=");
    expect(envExample).toContain("pgbouncer=true");
    expect(gitignore).toContain(".vercel");
    expect(gitignore).toContain(".env.vercel.local");
    expect(readme).toContain("## Vercel");
    expect(readme).toContain("DATABASE_URL_UNPOOLED");
    expect(readme).toContain("ADMIN_TRUST_PROXY=true");
    expect(readme).toContain("PAYMENTS_TRUST_PROXY=true");
    expect(readme).toContain("PAYMENTS_ENABLED=false");
    expect(readme).toContain("/api/payments/webhook");
    expect(existsSync(resolve(root, ".nvmrc"))).toBe(true);
    expect(read(".nvmrc").trim()).toBe("20");
  });
});
