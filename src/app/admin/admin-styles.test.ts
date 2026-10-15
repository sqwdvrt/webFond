import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/app/admin/admin.module.css"),
  "utf8",
);

describe("admin form control styles", () => {
  it("styles text inputs, textareas, and selects consistently", () => {
    expect(css).toMatch(
      /\.field input,\s*\.field textarea,\s*\.field select\s*\{[^}]*width:\s*100%[^}]*border:\s*1px solid #aeb7b0[^}]*font:\s*inherit/s,
    );
    expect(css).toMatch(
      /\.field input,\s*\.field textarea,\s*\.field select\s*\{[^}]*background:\s*var\(--surface\)/s,
    );
    expect(css).toMatch(
      /\.field textarea\s*\{[^}]*min-height:[^}]*resize:\s*vertical/s,
    );
    expect(css).toMatch(
      /\.field input\[aria-invalid="true"\],\s*\.field textarea\[aria-invalid="true"\],\s*\.field select\[aria-invalid="true"\]\s*\{[^}]*border-color:\s*#a63f36/s,
    );
    expect(css).toMatch(
      /\.field input:focus-visible,\s*\.field textarea:focus-visible,\s*\.field select:focus-visible\s*\{[^}]*outline:\s*2px solid/s,
    );
    expect(css).toContain(':focus-visible');
    expect(css).toContain('[aria-invalid="true"]');
  });
});
