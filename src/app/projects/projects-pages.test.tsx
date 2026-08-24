import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderProjectsPage } from "@/app/projects/page";
import { projects } from "@/content/projects";
import type { PublicEditorialListRow } from "@/features/content-admin/repository";

const publishedProject: PublicEditorialListRow = {
  id: "project-1",
  title: "Опубликованный проект",
  slug: "published-project",
  summary: "Проверенное описание опубликованного проекта.",
  imageUrl: "/media/project.jpg",
  publishedAt: new Date("2026-08-22T10:00:00.000Z"),
};

function dependencies(result: PublicEditorialListRow[] | Error) {
  return {
    listProjects: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

function expectCharterList(container: HTMLElement) {
  expect(screen.getByRole("heading", {
    level: 1,
    name: "Цели, предмет и виды деятельности фонда",
  })).toBeVisible();
  expect(screen.getByText(
    "Фонд помогает людям, которым особенно нужна поддержка, и объединяет необходимые для этого усилия и средства.",
  )).toBeVisible();
  expect(screen.queryByText("Виды деятельности по уставу")).not.toBeInTheDocument();

  const activityList = container.querySelector("ul.activity-list");
  expect(activityList).toHaveAttribute("role", "list");
  expect(
    Array.from(activityList?.querySelectorAll(":scope > li") ?? []).map(
      (item) => item.textContent,
    ),
  ).toEqual(projects.map((project) => project.homepageDescription));
  expect(activityList?.querySelector("article, a, svg")).not.toBeInTheDocument();
}

describe("projects page", () => {
  it("keeps the statutory list and appends published project cards", async () => {
    const deps = dependencies([publishedProject]);
    const { container } = render(await renderProjectsPage(deps));

    expectCharterList(container);
    expect(screen.getByRole("heading", { level: 2, name: "Проекты фонда" })).toBeVisible();
    expect(screen.getByRole("link", { name: publishedProject.title })).toHaveAttribute(
      "href",
      `/projects/${publishedProject.slug}`,
    );
    expect(screen.getByText(publishedProject.summary!)).toBeVisible();
    expect(deps.listProjects).toHaveBeenCalledOnce();
  });

  it("adds no project block when there are no published projects", async () => {
    const { container } = render(await renderProjectsPage(dependencies([])));

    expectCharterList(container);
    expect(screen.queryByRole("heading", { level: 2, name: "Проекты фонда" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Конкретные программы и проекты будут опубликованы/)).not.toBeInTheDocument();
    expect(container.querySelector(".published-grid")).not.toBeInTheDocument();
  });

  it("keeps the charter and shows a temporary error when the read fails", async () => {
    const { container } = render(
      await renderProjectsPage(dependencies(new Error("database unavailable"))),
    );

    expectCharterList(container);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Проекты временно недоступны. Попробуйте обновить страницу позже.",
    );
    expect(screen.queryByText("database unavailable")).not.toBeInTheDocument();
  });

  it("preserves the statutory copy without invented legacy projects", async () => {
    const { container } = render(await renderProjectsPage(dependencies([])));

    expect(container.querySelector(".project-card, .project-status")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /Направления помощи|Помощь рядом|Забота о старших|Поддержка детям|Три направления/,
    );
    expect(Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"))).not.toEqual(
      expect.arrayContaining([
        "/projects/pomoshch-ryadom",
        "/projects/zabota-o-starshih",
        "/projects/podderzhka-detyam",
      ]),
    );
  });
});
