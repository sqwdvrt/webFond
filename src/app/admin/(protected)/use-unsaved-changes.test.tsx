import { useRef } from "react";
import Link from "next/link";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { UnsavedChangesNotice } from "./unsaved-changes-notice";
import { MessageForm } from "./messages/message-form";

function Harness() {
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedChanges(formRef);
  return <><Link href="/admin/news">Новости</Link><form ref={formRef}>
    <input name="title" aria-label="Название" defaultValue="Исходное" />
    <input name="updatedAt" type="hidden" defaultValue="1" />
    <UnsavedChangesNotice guard={guard} />
  </form></>;
}

function unload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("unsaved changes", () => {
  beforeEach(() => {
    // jsdom does not implement native modal behavior. Browser coverage is separate.
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
      this.querySelector<HTMLButtonElement>("button")?.focus();
    };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  it("compares values, ignores technical fields and removes beforeunload after reverting", () => {
    render(<Harness />);
    expect(unload()).toBe(false);
    fireEvent.change(document.querySelector('[name="updatedAt"]')!, { target: { value: "2" } });
    expect(unload()).toBe(false);
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новое" } });
    expect(screen.getByRole("status")).toHaveTextContent("Есть несохранённые изменения");
    expect(unload()).toBe(true);
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Исходное" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(unload()).toBe(false);
  });

  it("detects programmatic changes", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Название") as HTMLInputElement;
    act(() => {
      input.value = "Из загрузки";
      input.dispatchEvent(new Event("editorialchange", { bubbles: true }));
    });
    expect(unload()).toBe(true);
  });

  it("confirms anchor departure, restores focus on cancel and leaves history untouched", async () => {
    const user = userEvent.setup();
    const push = vi.spyOn(history, "pushState");
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новое" } });
    const link = screen.getByRole("link");
    await user.click(link);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Остаться" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Остаться" }));
    expect(link).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("replays a confirmed anchor only once and clears native unload protection", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новое" } });
    const link = screen.getByRole("link");
    await user.click(link);
    const navigate = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener("click", navigate);
    await user.click(screen.getByRole("button", { name: "Уйти" }));
    expect(navigate).toHaveBeenCalledOnce();
    // If a navigation is canceled downstream, the editor remains protected.
    await waitFor(() => expect(unload()).toBe(true));
  });

  it("also guards logout and quick actions submitted from another form", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<><Harness /><form onSubmit={submitted}><button type="submit">Выйти</button></form></>);
    fireEvent.change(screen.getByLabelText("Название"), { target: { value: "Новое" } });
    await user.click(screen.getByRole("button", { name: "Выйти" }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Уйти$/ }));
    expect(submitted).toHaveBeenCalledOnce();
  });

  it("retains errors and dirty state then adopts a saved server version in the same editor", async () => {
    const user = userEvent.setup();
    const contact = { status: "NEW" as const, internalNote: "Старая заметка", updatedAt: new Date("2026-10-01") };
    const action = vi.fn(async () => ({ status: "error" as const, message: "Конфликт версий" }));
    const view = render(<MessageForm contact={contact} action={action} />);
    await user.clear(screen.getByLabelText("Внутренняя заметка"));
    await user.type(screen.getByLabelText("Внутренняя заметка"), "Новая заметка");
    await user.click(screen.getByRole("button", { name: "Сохранить обращение" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Конфликт версий");
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue("Новая заметка");
    expect(unload()).toBe(true);
    view.rerender(<MessageForm contact={{ ...contact, internalNote: "Новая заметка", updatedAt: new Date("2026-10-02") }} action={action} successMessage="Сохранено" />);
    await waitFor(() => expect(unload()).toBe(false));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Внутренняя заметка")).toHaveValue("Новая заметка");
    await user.type(screen.getByLabelText("Внутренняя заметка"), "!");
    expect(unload()).toBe(true);
  });
});
