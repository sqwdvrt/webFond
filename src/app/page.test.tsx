import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { charterGroups } from "@/content/projects";

describe("HomePage", () => {
  it("renders the mission, actions, and charter activities", () => {
    const { container } = render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Помогаем быть рядом" })).toBeVisible();
    expect(screen.getByText(/поддерживает людей в трудной ситуации/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Помочь фонду" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "О фонде" })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: "Нужна помощь?" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Чем занимается фонд" })).toBeVisible();
    expect(container.querySelector("ul.activity-list")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      ...charterGroups.map((group) => group.title),
      "Поддержать фонд",
      "Другие формы участия",
    ]);
    expect(screen.getByRole("link", { name: "Полный перечень по уставу" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(container.querySelectorAll(".project-card-compact")).toHaveLength(0);
    expect(screen.queryByText("Виды деятельности по уставу")).not.toBeInTheDocument();
    expect(screen.queryByText(/Конкретные программы и проекты будут опубликованы/)).not.toBeInTheDocument();
  });

  it("keeps a short section order without empty theater", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Чем занимается фонд",
      "Как помочь",
      "Новости и отчеты",
      "Напишите нам",
    ]);
    expect(Array.from(document.querySelectorAll(".section-number")).map((item) => item.textContent)).toEqual([
      "01",
      "02",
      "03",
    ]);
    expect(screen.queryByText("Подтвержденные факты")).not.toBeInTheDocument();
    expect(screen.queryByText(/17 июля 2025 года/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Направления помощи|Помощь рядом|Забота о старших|Поддержка детям|Три направления/)).not.toBeInTheDocument();
  });

  it("describes help without emphasizing payment periodicity", () => {
    const { container } = render(<><SiteHeader /><main><HomePage /></main><SiteFooter /></>);
    expect(container.textContent?.toLowerCase()).not.toMatch(/разов|единоврем|подпис|автоспис/);
  });
});
