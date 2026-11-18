import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { privacyPolicyPublication } from "@/content/legal";
import { PublishedLegalDocumentView } from "./published-legal-document";

describe("legal document navigation", () => {
  it("links every approved section without changing its text", () => {
    render(<PublishedLegalDocumentView document={privacyPolicyPublication} />);
    const contents = screen.getByRole("navigation", { name: "Содержание документа" });
    fireEvent.click(within(contents).getByText(/Содержание документа/));
    for (const [index, section] of privacyPolicyPublication.sections.entries()) {
      const link = within(contents).getByRole("link", { name: section.heading });
      expect(link).toHaveAttribute("href", `#document-section-${index + 1}`);
      expect(screen.getByRole("heading", { name: section.heading, level: 2 })).toHaveAttribute("id", `document-section-${index + 1}`);
      for (const paragraph of section.paragraphs) expect(screen.getByText(paragraph, { exact: true })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "К содержанию документа" })).toHaveAttribute("href", "#document-contents");
  });
});
