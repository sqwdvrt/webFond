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

  it("renders a charter activity without a detail link", () => {
    render(<ProjectCard project={projects[0]} />);
    expect(screen.getByText("Виды деятельности по уставу")).toBeVisible();
    expect(screen.getByText(/Помощь социально незащищенным гражданам/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /Подробнее/ })).toBeNull();
  });

  it("renders the compact charter activity with a number and no repeated status", () => {
    render(<ProjectCard project={projects[0]} compact number={1} />);
    expect(screen.getByText("01")).toHaveClass("project-number");
    expect(screen.getByText(/Помощь социально незащищенным гражданам/)).toBeVisible();
    expect(screen.queryByText("Виды деятельности по уставу")).not.toBeInTheDocument();
  });

  it("renders an honest empty state", () => {
    render(<EmptyState title="Материалы готовятся к публикации" description="Мы добавим их после проверки." />);
    expect(screen.getByText("Материалы готовятся к публикации")).toBeVisible();
    expect(screen.getByText("Мы добавим их после проверки.")).toBeVisible();
  });
});
