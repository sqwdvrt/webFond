import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { homepageHelpGroups } from "@/content/projects";

describe("HomePage", () => {
  it("renders the mission, actions, help groups, trust and contacts", () => {
    const { container } = render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Фонд «Быть Добру»" })).toBeVisible();
    expect(
      screen.getByText(
        /Помогаем людям, оказавшимся в трудной жизненной ситуации, и объединяем тех, кто готов поддержать добрые дела/,
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Помочь фонду" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Нужна помощь" })).toHaveAttribute("href", "/need-help");
    expect(screen.getByRole("heading", { level: 2, name: "Кому мы помогаем" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Как работает помощь" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Почему нам можно доверять" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Документы фонда" })).toBeVisible();
    expect(container.querySelector("ul.activity-list")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      ...homepageHelpGroups.map((group) => group.title),
      "1. Напишите фонду",
      "2. Мы уточним ситуацию",
      "3. Согласуем понятный формат помощи",
      "Проверяемые сведения",
      "Открытые документы",
      "Честный статус платежей",
      "Поддержать фонд",
      "Другие формы участия",
    ]);
    expect(screen.getByRole("link", { name: "Все направления" })).toHaveAttribute(
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
      "Кому мы помогаем",
      "Как работает помощь",
      "Почему нам можно доверять",
      "Как помочь",
      "Документы фонда",
      "Напишите нам",
    ]);
    expect(Array.from(document.querySelectorAll(".section-number")).map((item) => item.textContent)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
    ]);
    expect(screen.queryByRole("link", { name: "Новости" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Отчеты" })).not.toBeInTheDocument();
    expect(screen.queryByText("Подтвержденные факты")).not.toBeInTheDocument();
    expect(screen.getByText(/17 июля 2025 года/)).toBeVisible();
    expect(screen.queryByText(/Направления помощи|Помощь рядом|Забота о старших|Поддержка детям|Три направления/)).not.toBeInTheDocument();
  });

  it("describes help without emphasizing payment periodicity", () => {
    const { container } = render(<><SiteHeader /><main><HomePage /></main><SiteFooter /></>);
    expect(container.textContent?.toLowerCase()).not.toMatch(/разов|единоврем|подпис|автоспис/);
  });
});
