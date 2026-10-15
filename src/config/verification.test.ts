import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as { scripts: Record<string, string> };
const readme = readFileSync("README.md", "utf8");
const checksSection = readme.match(/## Проверки([\s\S]*?)## Платежи/)?.[1] ?? "";

describe("release verification", () => {
  it("runs the complete release gate in order", () => {
    expect(packageJson.scripts.verify).toBe(
      "npm test && npm run lint && npm run typecheck && npm run db:validate && npm run build && git diff --check HEAD",
    );
  });

  it("rejects staged whitespace errors through the configured diff check", () => {
    const repository = mkdtempSync(join(tmpdir(), "release-verification-"));

    try {
      const runGit = (...args: string[]) =>
        spawnSync("git", args, { cwd: repository, encoding: "utf8" });

      expect(runGit("init", "--quiet").status).toBe(0);
      expect(runGit("config", "user.name", "Verification Test").status).toBe(0);
      expect(
        runGit("config", "user.email", "verification@example.test").status,
      ).toBe(0);
      writeFileSync(join(repository, "tracked.txt"), "clean\n");
      expect(runGit("add", "tracked.txt").status).toBe(0);
      expect(runGit("commit", "--quiet", "-m", "baseline").status).toBe(0);

      writeFileSync(join(repository, "tracked.txt"), "trailing whitespace \n");
      expect(runGit("add", "tracked.txt").status).toBe(0);

      const diffCheck = packageJson.scripts.verify.split(" && ").at(-1);
      const result = spawnSync(diffCheck ?? "", {
        cwd: repository,
        encoding: "utf8",
        shell: true,
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("trailing whitespace");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it("documents prerequisites and separate integration checks", () => {
    expect(checksSection).toContain(".env");
    expect(checksSection).toContain("DATABASE_URL");
    expect(checksSection).toContain("DATABASE_URL_UNPOOLED");
    expect(checksSection).toContain("npm run verify");
    expect(checksSection).toMatch(/платеж/i);
    expect(checksSection).toMatch(/миграц/i);
    expect(readme).toContain("npm run test:integration:payments");
    expect(readme).toContain(
      "npm test -- src/db/content-migration.integration.test.ts",
    );
  });

  it("documents the deployment health checks", () => {
    expect(readme).toMatch(/\/api\/health[^\n]*liveness[^\n]*без авторизации/i);
    expect(readme).toMatch(/\/api\/ready[^\n]*(configuration|конфигурац)/i);
    expect(readme).toMatch(/\/api\/ready[\s\S]{0,160}`503`/i);
  });
});
