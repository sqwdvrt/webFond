import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createProjectMutation,
  type ContentFormState,
} from "@/features/content-admin/mutations";
import type { CreateEditorialResult } from "@/features/content-admin/repository";
import { parseProjectForm } from "@/features/content-admin/validation";

import { ProjectForm } from "./project-form";

const edits = {
  title: "Обновленный проект",
  slug: "obnovlennyy-proekt",
  summary: "Новое краткое описание проекта",
  content: "Новый подробный текст проекта после редактирования.",
  imageUrl: "/images/projects/updated.jpg",
  status: "ARCHIVED",
} as const;

describe("ProjectForm React action integration", () => {
  it("generates the address from the title and preserves a manually chosen address", async () => {
    const user = userEvent.setup();
    render(<ProjectForm mode="create" saveAction={async (state) => state} />);

    await user.type(screen.getByLabelText("Название"), "Помощь детям");
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue("pomoshch-detyam");
    expect(screen.getByText(/\/projects\/pomoshch-detyam/)).toBeVisible();
    await user.clear(screen.getByLabelText("Адрес страницы"));
    await user.type(screen.getByLabelText("Адрес страницы"), "deti-2026");
    await user.type(screen.getByLabelText("Название"), " Москвы");
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue("deti-2026");
  });

  it("keeps an existing address when the project title changes", async () => {
    const user = userEvent.setup();
    render(<ProjectForm mode="edit" saveAction={async (state) => state} />);
    await user.type(screen.getByLabelText("Адрес страницы"), "existing-project");
    await user.type(screen.getByLabelText("Название"), "Новое название");
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue("existing-project");
  });

  it("preserves every submitted edit after a duplicate repository error", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (): Promise<CreateEditorialResult> => ({
      status: "duplicate",
    }));
    const action = async (
      _state: ContentFormState,
      formData: FormData,
    ): Promise<ContentFormState> => {
      const result = await createProjectMutation(formData, {
        requireSession: async () => undefined,
        parse: parseProjectForm,
        create,
      });
      if (result.ok) throw new Error("Expected a duplicate error");
      return result.state;
    };

    render(<ProjectForm mode="create" saveAction={action} />);

    await user.type(screen.getByLabelText("Название"), edits.title);
    await user.clear(screen.getByLabelText("Адрес страницы"));
    await user.type(screen.getByLabelText("Адрес страницы"), edits.slug);
    await user.type(screen.getByLabelText("Краткое описание"), edits.summary);
    await user.type(screen.getByLabelText("Содержание"), edits.content);
    await user.type(screen.getByLabelText("Изображение"), edits.imageUrl);
    await user.selectOptions(screen.getByLabelText("Статус"), edits.status);
    await user.click(screen.getByRole("button", { name: "Создать проект" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Такой адрес уже используется",
    );
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Название")).toHaveValue(edits.title);
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue(edits.slug);
    expect(screen.getByLabelText("Краткое описание")).toHaveValue(edits.summary);
    expect(screen.getByLabelText("Содержание")).toHaveValue(edits.content);
    expect(screen.getByLabelText("Изображение")).toHaveValue(edits.imageUrl);
    expect(screen.getByLabelText("Статус")).toHaveValue(edits.status);
  });
});
