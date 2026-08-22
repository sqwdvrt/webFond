import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { projects } from "@/content/projects";

function publicSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return publicSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) && !path.endsWith(".test.ts") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("public content integrity", () => {
  it("does not use the long dash character in public source", () => {
    const offenders = publicSourceFiles(join(process.cwd(), "src"))
      .filter((file) => readFileSync(file, "utf8").includes("—"));
    expect(offenders).toEqual([]);
  });

  it("does not add numeric claims to charter activity descriptions", () => {
    for (const activity of projects) {
      expect(activity.description).not.toMatch(/\d/);
    }
  });
});
