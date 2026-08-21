import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the approved mission, actions, and three directions", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Помогаем людям, оказавшимся/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Помочь фонду" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Нужна помощь?" })).toHaveAttribute("href", "/contacts#help-request");
    expect(screen.getAllByText("Направление работы")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 3, name: "Поддержать фонд" })).toBeVisible();
  });

  it("keeps the approved section order and continuous numbering", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Направления помощи",
      "Как можно помочь",
      "Материалы готовятся к публикации",
      "Проверенные отчеты появятся здесь",
      "Свяжитесь с фондом",
    ]);
    expect(screen.getByText("01")).toBeVisible();
    expect(screen.getByText("02")).toBeVisible();
    expect(screen.getByText("03 Новости")).toBeVisible();
    expect(screen.getByText("04 Отчеты")).toBeVisible();
    expect(screen.queryByText("Подтвержденные факты")).not.toBeInTheDocument();
    expect(screen.queryByText(/17 июля 2025 года/)).not.toBeInTheDocument();
  });

  it("describes help without emphasizing payment periodicity", () => {
    const { container } = render(<HomePage />);
    expect(container.textContent?.toLowerCase()).not.toMatch(/разов|единоврем|подпис|автоспис/);
  });
});
