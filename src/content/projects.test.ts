import { describe, expect, it } from "vitest";

import { getProjectBySlug, projects, projectSlugs } from "@/content/projects";

describe("approved projects", () => {
  it("contains exactly the three approved directions", () => {
    expect(projectSlugs).toEqual([
      "pomoshch-ryadom",
      "zabota-o-starshih",
      "podderzhka-detyam",
    ]);
    expect(projects.map((project) => project.title)).toEqual([
      "Помощь рядом",
      "Забота о старших",
      "Поддержка детям",
    ]);
  });

  it("keeps neutral status, internal links, and no invented metrics", () => {
    for (const project of projects) {
      expect(project.status).toBe("Направление работы");
      expect(project.href).toBe(`/projects/${project.slug}`);
      expect(project).not.toHaveProperty("raised");
      expect(project).not.toHaveProperty("goal");
      expect(project).not.toHaveProperty("beneficiaries");
      expect(getProjectBySlug(project.slug)).toEqual(project);
    }
    expect(getProjectBySlug("unknown")).toBeUndefined();
  });
});
