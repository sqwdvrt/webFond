import { render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import ProjectsPage from "@/app/projects/page";
import { projects } from "@/content/projects";

describe("project pages", () => {
  it("renders charter activity types without invented project names", () => {
    const { container } = render(<ProjectsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Цели, предмет и виды деятельности фонда" })).toBeVisible();
    expect(screen.getByText("Фонд помогает людям, которым особенно нужна поддержка, и объединяет необходимые для этого усилия и средства.")).toBeVisible();
    expect(screen.queryByText("Виды деятельности по уставу")).not.toBeInTheDocument();
    expect(screen.queryByText(/Конкретные программы и проекты будут опубликованы/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    const activityList = container.querySelector("ul.activity-list");
    expect(activityList).toHaveAttribute("role", "list");
    expect(Array.from(activityList?.querySelectorAll(":scope > li") ?? []).map((item) => item.textContent)).toEqual(
      projects.map((project) => project.homepageDescription),
    );
    expect(activityList?.querySelector("article, a, svg")).not.toBeInTheDocument();
    expect(container.querySelector(".project-card, .project-status")).not.toBeInTheDocument();
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
