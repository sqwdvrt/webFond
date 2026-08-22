import { render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import ProjectsPage from "@/app/projects/page";

describe("project pages", () => {
  it("renders charter activity types without invented project names", () => {
    const { container } = render(<ProjectsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Цели, предмет и виды деятельности фонда" })).toBeVisible();
    expect(screen.getByText("Конкретные программы и проекты будут опубликованы после их утверждения фондом")).toBeVisible();
    expect(container.querySelectorAll(".project-status")).toHaveLength(8);
    expect(container.textContent).not.toMatch(/Направления помощи|Помощь рядом|Забота о старших|Поддержка детям|Три направления/);
    expect(Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"))).not.toEqual(
      expect.arrayContaining([
        "/projects/pomoshch-ryadom",
        "/projects/zabota-o-starshih",
        "/projects/podderzhka-detyam",
      ]),
    );
  });

  it("does not keep generated routes for invented project pages", () => {
    expect(existsSync(join(process.cwd(), "src/app/projects/[slug]/page.tsx"))).toBe(false);
  });
});
