import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Timeweb runtime contract", () => {
  it("provides Timeweb an explicit Next.js runtime port and start command", () => {
    expect(existsSync(resolve(root, "Dockerfile"))).toBe(true);
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain('CMD ["npm", "run", "timeweb-start"]');
  });

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
