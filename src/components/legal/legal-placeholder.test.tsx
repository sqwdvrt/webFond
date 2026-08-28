import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalPlaceholder, legalPlaceholderMetadata } from "@/components/legal/legal-placeholder";

describe("LegalPlaceholder", () => {
  it("does not invent legal clauses", () => {
    render(<LegalPlaceholder title="Политика конфиденциальности" />);
    expect(screen.getByRole("heading", { name: "Документ готовится к публикации" })).toBeVisible();
  });

  it("is noindex", () => {
    expect(legalPlaceholderMetadata("Документ").robots).toEqual({ index: false, follow: true });
  });
});
