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
  it("uses the approved adaptive surface contract", () => {
    expect(readDeclarations(".hero-logo")).toMatchObject({
      width: "clamp(240px, 26vw, 360px)",
      "max-width": "100%",
      "justify-self": "center",
      "aspect-ratio": "1",
      padding: "28px",
      border: "2px solid var(--brand)",
      "border-radius": "8px",
      overflow: "hidden",
      "box-shadow": "0 18px 48px rgba(31, 91, 37, 0.12)",
    });
  });

  it("does not override the logo at the mobile breakpoint", () => {
    const mobileStart = css.indexOf("@media (max-width: 720px)");
    const mobileEnd = css.indexOf("@media", mobileStart + 1);
    const mobileStyles = css.slice(mobileStart, mobileEnd);

    expect(mobileStart).toBeGreaterThan(-1);
    expect(mobileStyles).not.toMatch(/\.hero-logo\s*\{/);
    expect(mobileStyles).not.toContain("width: min(100%, 330px)");
    expect(mobileStyles).not.toContain("justify-self: start");
  });

  it("keeps the header mark square like the hero photo", () => {
    expect(readDeclarations(".brand-mark")).toMatchObject({
      "border-radius": "8px",
    });
  });
});
