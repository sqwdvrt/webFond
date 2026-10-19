import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("prevents click and keyboard saves during upload and tracks the uploaded URL as unsaved", async () => {
    const user = userEvent.setup();
    let complete!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const save = vi.fn(async (state: ContentFormState) => state);
    render(<ProjectForm mode="create" saveAction={save} />);
    await user.type(screen.getByLabelText("Название"), "Проект");
    await user.upload(screen.getByLabelText("Загрузить изображение"), new File(["image"], "image.jpg", { type: "image/jpeg" }));
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeDisabled();
    expect(screen.getByText("Дождитесь завершения загрузки перед сохранением.")).toBeVisible();
    fireEvent.submit(screen.getByLabelText("Название").closest("form")!);
    expect(save).not.toHaveBeenCalled();
    await act(async () => { complete(new Response(JSON.stringify({ url: "/uploaded.jpg" }))); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeEnabled());
    expect(screen.getByLabelText("Изображение")).toHaveValue("/uploaded.jpg");
    expect(screen.getByText("Есть несохранённые изменения")).toBeVisible();
    fetchMock.mockRestore();
  });

  it("submits a validated returnTo without counting it as an editorial change", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (): Promise<ContentFormState> => ({ status: "error", message: "Ошибка" }));
    render(<ProjectForm mode="create" returnTo="/admin/projects?status=DRAFT&page=2" saveAction={save} />);
    expect(screen.queryByText("Есть несохранённые изменения")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Название"), "Проект");
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect((save.mock.calls[0] as unknown as [ContentFormState, FormData])[1].get("returnTo")).toBe("/admin/projects?status=DRAFT&page=2");
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
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Такой адрес уже используется",
    );
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Название")).toHaveValue(edits.title);
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue(edits.slug);
    expect(screen.getByLabelText("Краткое описание")).toHaveValue(edits.summary);
    expect(screen.getByLabelText("Содержание")).toHaveValue(edits.content);
    expect(screen.getByLabelText("Изображение")).toHaveValue(edits.imageUrl);
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeVisible();
  });
});
