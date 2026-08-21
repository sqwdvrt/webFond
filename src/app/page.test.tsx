import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the approved mission, actions, and three directions", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Помогаем людям, оказавшимся/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Сделать пожертвование" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Нужна помощь?" })).toHaveAttribute("href", "/contacts#help-request");
    expect(screen.getAllByText("Направление работы")).toHaveLength(3);
  });

  it("shows confirmed facts and honest placeholders", () => {
    render(<HomePage />);
    expect(screen.getByText(/17 июля 2025 года/)).toBeVisible();
    expect(screen.getByText("Материалы готовятся к публикации")).toBeVisible();
    expect(screen.getByText("Проверенные отчеты появятся здесь")).toBeVisible();
  });
});
