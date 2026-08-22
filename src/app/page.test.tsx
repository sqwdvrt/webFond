import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

describe("HomePage", () => {
  it("renders the approved mission, actions, and charter activities", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Помогаем людям, оказавшимся/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Помочь фонду" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Нужна помощь?" })).toHaveAttribute("href", "/contacts#help-request");
    expect(screen.getByRole("heading", { level: 2, name: "Цели, предмет и виды деятельности фонда" })).toBeVisible();
    expect(screen.getByText("Конкретные программы и проекты будут опубликованы после их утверждения фондом")).toBeVisible();
    expect(screen.getAllByText("Виды деятельности по уставу")).toHaveLength(8);
    expect(screen.getByText("Помощь социально незащищенным гражданам, находящимся в тяжелом материальном положении.")).toBeVisible();
    expect(screen.getByText("Разработка и реализация проектов для финансирования социальной сферы с участием бизнеса, бюджета и физических лиц.")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 3 }).slice(8).map((heading) => heading.textContent)).toEqual([
      "Поддержать фонд",
      "Волонтерство",
      "Партнерство",
      "Информационная поддержка",
    ]);
  });

  it("keeps the approved section order and continuous numbering", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Цели, предмет и виды деятельности фонда",
      "Как можно помочь",
      "Материалы готовятся к публикации",
      "Проверенные отчеты появятся здесь",
      "Свяжитесь с фондом",
    ]);
    expect(Array.from(document.querySelectorAll(".section-number")).map((item) => item.textContent)).toEqual([
      "01",
      "02",
      "03 Новости",
      "04 Отчеты",
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
