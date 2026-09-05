import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Timeweb runtime contract", () => {
  it("migrates during build and only starts Next.js at runtime", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["timeweb-build"]).toBe(
      "prisma generate && prisma migrate deploy && next build",
    );
    expect(packageJson.scripts?.["timeweb-start"]).toBe(
      "next start --hostname 0.0.0.0 --port ${PORT:-3000}",
    );
  });

  it("documents Timeweb as production and the required public site URL", () => {
    const envExample = read(".env.example");
    const readme = read("README.md");

    expect(envExample).toContain("NEXT_PUBLIC_SITE_URL=");
    expect(readme).toContain("## Timeweb");
    expect(readme).toContain("npm run timeweb-build");
    expect(readme).toContain("npm run timeweb-start");
    expect(readme).toContain("NEXT_PUBLIC_SITE_URL");
    expect(readme).toContain("/api/health");
    expect(readme).toContain("fond-bit-dobru.ru");
  });
});
