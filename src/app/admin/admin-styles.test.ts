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
    const mobileRules = parseRules(mediaContentsFor("(max-width: 720px)"));
    expect(
      mobileRules.some(
        ({ selectors }) =>
          selectors === ".adminNavFrame::before, .adminNavFrame::after",
      ),
    ).toBe(true);
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

describe("admin dashboard styles", () => {
  it("keeps metric cards width-safe and collapses the grid on mobile", () => {
    expect(declarationsFor(".dashboardMetric")).toMatchObject({
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });

    const mobileRules = parseRules(mediaContentsFor("(max-width: 720px)"));
    const gridRule = mobileRules.find(
      ({ selectors }) => selectors === ".dashboardMetrics, .dashboardColumns",
    );

    expect(gridRule?.declarations).toMatchObject({
      "grid-template-columns": "minmax(0, 1fr)",
    });
  });

  it("makes the full warning message a safe keyboard target", () => {
    expect(declarationsFor(".dashboardAlerts li")).toMatchObject({
      "min-width": "0",
    });
    expect(declarationsFor(".dashboardAlerts a")).toMatchObject({
      display: "flex",
      "align-items": "center",
      "min-height": "44px",
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });
    expect(declarationsFor(".dashboardAlerts a:focus-visible")).toMatchObject({
      outline: "2px solid var(--brand)",
      "outline-offset": "2px",
    });
  });

  it("keeps activity text width-safe and distinguishes entity labels", () => {
    expect(declarationsFor(".dashboardActivity li")).toMatchObject({
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });
    expect(declarationsFor(".dashboardActivityEntity")).toMatchObject({
      color: "var(--muted)",
      "font-size": "12px",
      "font-weight": "700",
      "text-transform": "uppercase",
    });
  });
});

describe("admin contact table styles", () => {
  it("reduces the message filter grid before desktop columns overflow", () => {
    const tabletRules = parseRules(mediaContentsFor("(max-width: 1040px)"));
    const filterRule = tabletRules.find(
      ({ selectors }) => selectors === ".messageFilters",
    );

    expect(filterRule?.declarations).toMatchObject({
      "grid-template-columns": "repeat(3, minmax(0, 1fr))",
    });
  });

  it("renders a width-safe semantic table and wraps long contact data", () => {
    expect(declarationsFor(".contactTable")).toMatchObject({
      width: "100%",
      "border-collapse": "collapse",
      "table-layout": "fixed",
    });
    expect(declarationsFor(".contactTable")).not.toHaveProperty("min-width");
    expect(declarationsFor(".contactTable th", ".contactTable td")).toMatchObject({
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });
    expect(declarationsFor(".contactExcerpt")).toMatchObject({
      "overflow-wrap": "anywhere",
    });
    expect(declarationsFor(".contactEmail", ".contactDetailLink")).toMatchObject({
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });
  });

  it("exposes visible focus states for filters, contact links and pagination", () => {
    expect(
      declarationsFor(
        ".messageFilters input:focus-visible",
        ".messageFilters select:focus-visible",
        ".filterActions a:focus-visible",
        ".filterActions button:focus-visible",
      ),
    ).toMatchObject({
      outline: "2px solid var(--brand)",
      "outline-offset": "2px",
    });
    expect(
      declarationsFor(
        ".contactEmail:focus-visible",
        ".contactDetailLink:focus-visible",
        ".pagination a:focus-visible",
      ),
    ).toMatchObject({
      outline: "2px solid var(--brand)",
      "outline-offset": "2px",
    });
  });

  it("turns the same table DOM into cards without horizontal overflow on mobile", () => {
    const mobileRules = parseRules(mediaContentsFor("(max-width: 720px)"));
    const pageRule = mobileRules.find(({ selectors }) => selectors === ".messagesPage");
    const filterRule = mobileRules.find(({ selectors }) => selectors === ".messageFilters");
    const tableRule = mobileRules.find(({ selectors }) => selectors === ".contactTable");
    const headRule = mobileRules.find(({ selectors }) => selectors === ".contactTable thead");
    const bodyRule = mobileRules.find(({ selectors }) => selectors === ".contactTable tbody");
    const rowRule = mobileRules.find(({ selectors }) => selectors === ".contactTable tr");
    const cellRule = mobileRules.find(({ selectors }) => selectors === ".contactTable td");

    expect(pageRule?.declarations).toMatchObject({
      width: "min(100% - 32px, 1240px)",
    });
    expect(pageRule?.declarations).not.toHaveProperty("overflow-x");
    expect(filterRule?.declarations).toMatchObject({
      "grid-template-columns": "minmax(0, 1fr)",
    });
    expect(tableRule?.declarations).toMatchObject({ display: "block" });
    expect(headRule?.declarations).toMatchObject({
      position: "absolute",
      width: "1px",
      overflow: "hidden",
    });
    expect(headRule?.declarations.display).not.toBe("none");
    expect(bodyRule?.declarations).toMatchObject({ display: "grid" });
    expect(rowRule?.declarations).toMatchObject({ display: "grid" });
    expect(cellRule?.declarations).toMatchObject({
      display: "grid",
      "grid-template-columns": "minmax(88px, 0.35fr) minmax(0, 1fr)",
      "min-width": "0",
      "overflow-wrap": "anywhere",
    });
  });
});
