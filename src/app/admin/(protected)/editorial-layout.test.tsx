import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { NewsForm } from "./news/news-form";
import { DocumentForm } from "./documents/document-form";

describe("editorial form guidance", () => {
  it("groups news fields and updates the address preview and character counts", async () => {
    const user = userEvent.setup();
    render(<NewsForm mode="create" saveAction={async (state) => state} />);
    const main = screen.getByRole("group", { name: "Основная информация" });
    expect(within(main).getByLabelText("Заголовок")).toHaveAccessibleDescription(/160/);
    expect(screen.getByRole("group", { name: "Текст и изображение" })).toBeVisible();
    await user.type(screen.getByLabelText("Заголовок"), "Новости фонда");
    expect(screen.getByText("/news/novosti-fonda")).toBeVisible();
    expect(screen.getByText(/13 \/ 160/)).toBeVisible();
    await user.type(screen.getByLabelText("Краткое описание"), "Помогаем");
    expect(screen.getByText(/8 \/ 500/)).toBeVisible();
  });

  it("explains document categories and groups the PDF separately", async () => {
    const user = userEvent.setup();
    render(<DocumentForm mode="create" saveAction={async (state) => state} />);
    expect(within(screen.getByRole("group", { name: "О документе" })).getByLabelText("Категория"))
      .toHaveAccessibleDescription(/Отчеты/);
    expect(within(screen.getByRole("group", { name: "Файл документа" })).getByLabelText("Ссылка на документ"))
      .toBeVisible();
    await user.type(screen.getByLabelText("Название"), "Отчет");
    expect(screen.getByText(/5 \/ 160/)).toBeVisible();
  });
});
