import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { donationOfferPublication } from "@/content/donation-offer";
import {
  cookiesPublication,
  personalDataConsentPublication,
  privacyPolicyPublication,
} from "@/content/legal";
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

  it("keeps published legal documents complete and without placeholders", () => {
    for (const document of [
      donationOfferPublication,
      privacyPolicyPublication,
      personalDataConsentPublication,
      cookiesPublication,
    ]) {
      expect(document.status).toBe("published");
      if (document.status !== "published") {
        continue;
      }

      expect(document.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(document.title.trim().length).toBeGreaterThan(0);
      expect(document.sections.length).toBeGreaterThan(0);

      for (const section of document.sections) {
        expect(section.heading.trim().length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        for (const paragraph of section.paragraphs) {
          expect(paragraph.trim().length).toBeGreaterThan(0);
          expect(paragraph).not.toContain("—");
          expect(paragraph).not.toContain("УКАЗАТЬ");
          expect(paragraph).not.toMatch(/проект документа/i);
        }
      }
    }
  });
});
