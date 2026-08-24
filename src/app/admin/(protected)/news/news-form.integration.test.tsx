import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createNewsMutation,
  type ContentFormState,
} from "@/features/content-admin/mutations";
import type { CreateEditorialResult } from "@/features/content-admin/repository";
import { parseEditorialForm } from "@/features/content-admin/validation";

import { NewsForm } from "./news-form";

const edits = {
  title: "Обновленная новость",
  slug: "obnovlennaya-novost",
  summary: "Новое краткое описание новости",
  content: "Новый подробный текст новости после редактирования.",
  imageUrl: "/images/news/updated.jpg",
  status: "ARCHIVED",
} as const;

describe("NewsForm React action integration", () => {
  it("preserves every submitted edit after a duplicate repository error", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (): Promise<CreateEditorialResult> => ({
      status: "duplicate",
    }));
    const action = async (
      _state: ContentFormState,
      formData: FormData,
    ): Promise<ContentFormState> => {
      const result = await createNewsMutation(formData, {
        requireSession: async () => undefined,
        parse: parseEditorialForm,
        create,
      });
      if (result.ok) throw new Error("Expected a duplicate error");
      return result.state;
    };

    render(<NewsForm mode="create" saveAction={action} />);

    await user.type(screen.getByLabelText("Заголовок"), edits.title);
    await user.type(screen.getByLabelText("Адрес страницы"), edits.slug);
    await user.type(screen.getByLabelText("Краткое описание"), edits.summary);
    await user.type(screen.getByLabelText("Содержание"), edits.content);
    await user.type(screen.getByLabelText("Изображение"), edits.imageUrl);
    await user.selectOptions(screen.getByLabelText("Статус"), edits.status);
    await user.click(screen.getByRole("button", { name: "Создать новость" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Такой адрес уже используется",
    );
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Заголовок")).toHaveValue(edits.title);
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue(edits.slug);
    expect(screen.getByLabelText("Краткое описание")).toHaveValue(edits.summary);
    expect(screen.getByLabelText("Содержание")).toHaveValue(edits.content);
    expect(screen.getByLabelText("Изображение")).toHaveValue(edits.imageUrl);
    expect(screen.getByLabelText("Статус")).toHaveValue(edits.status);
  });
});
