import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function readDeclarations(selector: string) {
  const rule = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1];
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

describe("hero logo styles", () => {
  it("keeps the desktop mark compact", () => {
    expect(readDeclarations(".hero-logo")).toMatchObject({
      width: "240px",
      "max-width": "100%",
      "justify-self": "center",
      overflow: "hidden",
    });
  });

  it("hides the repeated mark on mobile", () => {
    const mobileStart = css.indexOf("@media (max-width: 720px)");
    const mobileEnd = css.indexOf("@media", mobileStart + 1);
    const mobileStyles = css.slice(mobileStart, mobileEnd);

    expect(mobileStart).toBeGreaterThan(-1);
    expect(mobileStyles).toMatch(/\.hero-logo\s*\{[^}]*display:\s*none/);
    expect(mobileStyles).not.toContain("width: min(100%, 330px)");
    expect(mobileStyles).not.toContain("justify-self: start");
  });

  it("keeps the header mark unframed on the navbar", () => {
    expect(readDeclarations(".brand-mark")).toMatchObject({
      background: "transparent",
      border: "0",
    });
    expect(readDeclarations(".brand-mark img")).toMatchObject({
      padding: "0",
      "mix-blend-mode": "multiply",
    });
  });
});
