import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as { scripts: Record<string, string> };
const readme = readFileSync("README.md", "utf8");

describe("release verification", () => {
  it("runs the complete release gate in order", () => {
    expect(packageJson.scripts.verify).toBe(
      "npm test && npm run lint && npm run typecheck && npm run db:validate && npm run build && git diff --check",
    );
  });

  it("documents the release gate and deployment health checks", () => {
    expect(readme).toContain("npm run verify");
    expect(readme).toMatch(/\/api\/health[^\n]*liveness/i);
    expect(readme).toMatch(/\/api\/ready[^\n]*(configuration|конфигурац)/i);
  });
});
