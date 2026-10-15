import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/app/admin/admin.module.css"),
  "utf8",
);

function parseRules(source: string) {
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selectors: match[1].trim().replace(/\s+/g, " "),
    declarations: Object.fromEntries(
      match[2]
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const separator = declaration.indexOf(":");

          return [
            declaration.slice(0, separator).trim(),
            declaration.slice(separator + 1).trim(),
          ];
        }),
    ),
  }));
}

function mediaContentsFor(query: string) {
  const marker = `@media ${query}`;
  const contents: string[] = [];
  let searchFrom = 0;

  while (searchFrom < css.length) {
    const start = css.indexOf(marker, searchFrom);

    if (start === -1) break;

    const openingBrace = css.indexOf("{", start + marker.length);
    let depth = 1;
    let cursor = openingBrace + 1;

    while (depth > 0 && cursor < css.length) {
      if (css[cursor] === "{") depth += 1;
      if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }

    contents.push(css.slice(openingBrace + 1, cursor - 1));
    searchFrom = cursor;
  }

  return contents.join("\n");
}

const rules = parseRules(css);

function declarationsFor(...selectors: string[]) {
  const selectorList = selectors.join(", ");
  const rule = rules.find((candidate) => candidate.selectors === selectorList);

  expect(rule, `Missing CSS rule: ${selectorList}`).toBeDefined();

  return rule!.declarations;
}

describe("admin navigation accessibility styles", () => {
  it("reveals the skip link above the sticky header when focused", () => {
    expect(declarationsFor(".skipLink")).toMatchObject({
      position: "fixed",
      top: "-100px",
      "z-index": "100",
    });
    expect(declarationsFor(".skipLink:focus")).toMatchObject({
      top: "12px",
    });
  });

  it("keeps mobile scroll affordances pinned to a non-scrolling frame", () => {
    expect(css).toMatch(
      /@media \(max-width: 720px\) \{\s*\.adminNavFrame::before,\s*\.adminNavFrame::after\s*\{/,
    );
    expect(declarationsFor(".adminNavFrame")).toMatchObject({
      position: "relative",
    });
    expect(declarationsFor(".adminNavFrame::before", ".adminNavFrame::after")).toMatchObject({
      position: "absolute",
      width: "24px",
      "pointer-events": "none",
    });
    expect(declarationsFor(".adminNavFrame::before")).toMatchObject({
      left: "0",
      background: "linear-gradient(to right, #24322a, transparent)",
    });
    expect(declarationsFor(".adminNavFrame::after")).toMatchObject({
      right: "0",
      background: "linear-gradient(to left, #24322a, transparent)",
    });
    expect(
      declarationsFor(".adminNavViewport", ".contentTableViewport"),
    ).toMatchObject({ "overflow-x": "auto" });
    expect(declarationsFor(".adminNavFrame")["overflow-x"]).not.toBe("auto");
  });

  it("adds mobile flex spacers that let edge navigation items center", () => {
    const mobileRules = parseRules(mediaContentsFor("(max-width: 720px)"));
    const spacerRule = mobileRules.find(
      ({ selectors }) => selectors === ".adminNav::before, .adminNav::after",
    );

    expect(spacerRule, "Missing mobile admin navigation spacer rule").toBeDefined();
    expect(spacerRule!.declarations).toMatchObject({
      content: '""',
      flex: "0 0 50vw",
      "pointer-events": "none",
    });
  });
});

describe("admin form control styles", () => {
  it("shares visible base styles across text inputs, textareas, and selects", () => {
    const declarations = declarationsFor(
      ".field input",
      ".field textarea",
      ".field select",
    );

    expect(declarations).toMatchObject({
      width: "100%",
      color: "var(--ink)",
      background: "var(--surface)",
      border: "1px solid #aeb7b0",
      "border-radius": "6px",
      font: "inherit",
      "font-weight": "400",
    });
  });

  it("keeps single-line controls and textareas appropriately sized", () => {
    expect(declarationsFor(".field input", ".field select")).toMatchObject({
      "min-height": "50px",
      padding: "0 14px",
    });
    expect(declarationsFor(".field textarea")).toMatchObject({
      "min-height": "112px",
      padding: "12px 14px",
      "line-height": "1.5",
      resize: "vertical",
    });
  });

  it("applies invalid and focus-visible states to every control type", () => {
    expect(
      declarationsFor(
        '.field input[aria-invalid="true"]',
        '.field textarea[aria-invalid="true"]',
        '.field select[aria-invalid="true"]',
      ),
    ).toMatchObject({ "border-color": "#a63f36" });
    expect(
      declarationsFor(
        ".field input:focus-visible",
        ".field textarea:focus-visible",
        ".field select:focus-visible",
      ),
    ).toMatchObject({
      outline: "2px solid var(--brand)",
      "outline-offset": "2px",
    });
  });

  it("preserves the file input override", () => {
    expect(declarationsFor('.field input[type="file"]')).toMatchObject({
      "min-height": "0",
      padding: "8px 0",
      background: "transparent",
      border: "0",
    });
  });
});
