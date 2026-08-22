import axe from "axe-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import ProjectsPage from "@/app/projects/page";
import { DonationPreview } from "@/components/donation/donation-preview";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

async function expectNoHighImpactViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const violations = results.violations.filter((item) =>
    item.impact === "serious" || item.impact === "critical",
  );
  expect(violations).toEqual([]);
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  return channels
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function rule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarations = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
  expect(declarations, `Missing CSS rule: ${selector}`).toBeTruthy();
  return declarations!;
}

function property(declarations: string, name: string) {
  const value = declarations.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`))?.[1].trim();
  expect(value, `Missing CSS property: ${name}`).toBeTruthy();
  return value!;
}

function color(css: string, value: string) {
  const variable = value.match(/var\((--[a-z0-9-]+)\)/i)?.[1];
  const resolved = variable
    ? css.match(new RegExp(`${variable}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]
    : value.match(/#[0-9a-f]{6}/i)?.[0];
  expect(resolved, `Unable to resolve CSS color: ${value}`).toBeTruthy();
  return resolved!;
}

describe("public accessibility", () => {
  it("has no serious or critical violations on the homepage shell", async () => {
    const { container } = render(<><SiteHeader /><main><HomePage /></main><SiteFooter /></>);
    await expectNoHighImpactViolations(container);
  });

  it("keeps the donation preview accessible while disabled", async () => {
    const { container } = render(<main><h1>Помочь фонду</h1><DonationPreview /></main>);
    await expectNoHighImpactViolations(container);
  });

  it("keeps project page headings in order", () => {
    const { container } = render(<ProjectsPage />);
    expect(Array.from(container.querySelectorAll("h1, h2, h3")).map((heading) => heading.tagName)).toEqual([
      "H1", "H2", "H3", "H3", "H3", "H3", "H3", "H3", "H3", "H3",
    ]);
  });

  it("keeps green bands and the dual focus ring above WCAG thresholds", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const contact = rule(css, ".contact-band");
    const contactBackground = color(css, property(contact, "background"));
    const contactForeground = color(css, property(contact, "color"));
    const paragraphForeground = color(css, property(rule(css, ".contact-band p"), "color"));
    const eyebrowForeground = color(css, property(rule(css, ".contact-band .eyebrow"), "color"));

    expect(contrast(contactForeground, contactBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(paragraphForeground, contactBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(eyebrowForeground, contactBackground)).toBeGreaterThanOrEqual(4.5);

    const focus = rule(css, ":focus-visible");
    const outline = color(css, property(focus, "outline"));
    const outerRing = color(css, property(focus, "box-shadow"));
    expect(contrast(outline, contactBackground)).toBeGreaterThanOrEqual(3);
    expect(contrast(outerRing, contactBackground)).toBeGreaterThanOrEqual(3);
    expect(contrast(outerRing, outline)).toBeGreaterThanOrEqual(3);
  });
});
