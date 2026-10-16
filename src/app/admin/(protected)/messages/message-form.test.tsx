import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContactMutationState } from "@/features/admin-messages/mutation";

import { MessageForm } from "./message-form";

const contact = {
  status: "NEW" as const,
  internalNote: "Ответить по электронной почте",
  updatedAt: new Date("2026-08-23T09:00:00.000Z"),
};

const idleAction = vi.fn(
  async (): Promise<ContactMutationState> => ({ status: "idle", message: "" }),
);

describe("MessageForm", () => {
  it("renders all statuses, the private note and only the canonical concurrency token hidden", () => {
    render(<MessageForm action={idleAction} contact={contact} />);

    expect(screen.getByLabelText("Статус обращения")).toHaveValue("NEW");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Новое",
      "В работе",
      "Закрыто",
      "Спам",
    ]);
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue(contact.internalNote);
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveAttribute("maxlength", "4000");
    expect(screen.getByText(/видна только администраторам/i)).toBeVisible();
    expect(document.querySelector('input[type="hidden"]')).toHaveAttribute(
      "name",
      "updatedAt",
    );
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      contact.updatedAt.toISOString(),
    );
    expect(document.querySelectorAll('input[type="hidden"]')).toHaveLength(1);
  });

  it("preserves submitted status and an empty note after validation errors", async () => {
    const action = vi.fn(async (
      _state: ContactMutationState,
      formData: FormData,
    ): Promise<ContactMutationState> => ({
      status: "error",
      message: "Проверьте заполнение формы",
      errors: { note: "Введите заметку текстом" },
      values: {
        status: String(formData.get("status")),
        note: null,
      },
    }));
    const user = userEvent.setup();
    render(<MessageForm action={action} contact={contact} />);

    await user.selectOptions(screen.getByLabelText("Статус обращения"), "SPAM");
    await user.clear(screen.getByLabelText("Внутренняя заметка"));
    await user.click(screen.getByRole("button", { name: "Сохранить обращение" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Проверьте заполнение формы",
    );
    expect(screen.getByLabelText("Статус обращения")).toHaveValue("SPAM");
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue("");
    expect(screen.getByText("Введите заметку текстом")).toHaveAttribute("role", "alert");
  });

  it("shows the optimistic concurrency error without replacing the submitted values", async () => {
    const action = vi.fn(async (): Promise<ContactMutationState> => ({
      status: "error",
      message: "Данные изменились. Обновите страницу и повторите действие",
      values: { status: "CLOSED", note: "Проверено" },
    }));
    render(<MessageForm action={action} contact={contact} />);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить обращение" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(screen.getByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Обновите страницу",
    );
    expect(screen.getByLabelText("Статус обращения")).toHaveValue("CLOSED");
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue("Проверено");
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      contact.updatedAt.toISOString(),
    );
  });

  it("renders redirect success feedback as an accessible status", () => {
    render(
      <MessageForm
        action={idleAction}
        contact={contact}
        successMessage="Обращение сохранено"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Обращение сохранено");
  });
});
