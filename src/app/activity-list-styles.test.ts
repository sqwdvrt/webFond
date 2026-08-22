import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function readDeclarations(styles: string, selector: string) {
  const rule = styles.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1];
  expect(rule).toBeDefined();

  return Object.fromEntries(
    rule!
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()];
      }),
  );
}

describe("activity list styles", () => {
  it("uses two equal columns by default", () => {
    expect(readDeclarations(css, ".activity-list")).toMatchObject({
      "grid-template-columns": "repeat(2, minmax(0, 1fr))",
    });
  });

  it("uses one column at the mobile breakpoint", () => {
    const mobileStart = css.indexOf("@media (max-width: 720px)");
    const mobileEnd = css.indexOf("@media", mobileStart + 1);
    const mobileStyles = css.slice(mobileStart, mobileEnd);

    expect(mobileStart).toBeGreaterThan(-1);
    expect(readDeclarations(mobileStyles, ".activity-list")).toMatchObject({
      "grid-template-columns": "1fr",
    });
  });
});
