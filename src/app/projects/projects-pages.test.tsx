import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProjectsPage from "@/app/projects/page";
import ProjectPage, { generateStaticParams } from "@/app/projects/[slug]/page";

describe("project pages", () => {
  it("renders all three directions", () => {
    render(<ProjectsPage />);
    expect(screen.getAllByText("Направление работы")).toHaveLength(3);
  });

  it("generates all approved slugs", () => {
    expect(generateStaticParams()).toEqual([
      { slug: "pomoshch-ryadom" },
      { slug: "zabota-o-starshih" },
      { slug: "podderzhka-detyam" },
    ]);
  });

  it("renders approved content and a neutral contact link", async () => {
    render(await ProjectPage({ params: Promise.resolve({ slug: "pomoshch-ryadom" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Помощь рядом" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Связаться с фондом" })).toHaveAttribute("href", "/contacts#help-request");
  });
});
