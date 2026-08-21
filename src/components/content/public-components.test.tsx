import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/content/empty-state";
import { PageHero } from "@/components/content/page-hero";
import { ProjectCard } from "@/components/content/project-card";
import { SectionHeading } from "@/components/content/section-heading";
import { projects } from "@/content/projects";

describe("public content components", () => {
  it("renders a semantic page hero and section heading", () => {
    render(
      <>
        <PageHero eyebrow="О фонде" title="Короткий заголовок" description="Описание" />
        <SectionHeading number="01" title="Направления" intro="Коротко о разделе" />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Короткий заголовок" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Направления" })).toBeVisible();
  });

  it("renders project status and internal detail link", () => {
    render(<ProjectCard project={projects[0]} />);
    expect(screen.getByText("Направление работы")).toBeVisible();
    expect(screen.getByRole("link", { name: /Подробнее/ })).toHaveAttribute(
      "href",
      "/projects/pomoshch-ryadom",
    );
  });

  it("renders an honest empty state", () => {
    render(<EmptyState title="Материалы готовятся к публикации" description="Мы добавим их после проверки." />);
    expect(screen.getByText("Материалы готовятся к публикации")).toBeVisible();
    expect(screen.getByText("Мы добавим их после проверки.")).toBeVisible();
  });
});
