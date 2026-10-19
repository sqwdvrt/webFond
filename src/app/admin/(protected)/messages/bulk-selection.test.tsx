import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
const action = vi.hoisted(() => vi.fn(async () => ({ status: "idle" as const, message: "" })));
vi.mock("./actions", () => ({ moveContactSelectionAction: action }));
import { MessagesView } from "./messages-view";

const row = { id: "contact-1", name: "Анна", email: "anna@example.org", message: "Помощь", status: "NEW" as const, createdAt: new Date(), updatedAt: new Date() };
const result = { rows: [row, { ...row, id: "contact-2", name: "Иван" }], total: 2, totalPages: 1, page: 1, pageSize: 25 };

describe("message selection", () => {
  it("selects only checked messages and supports selecting the page", async () => {
    const user = userEvent.setup();
    const { container } = render(<MessagesView filters={{ page: 1 }} result={result} />);
    expect(screen.getByRole("button", { name: "Архивировать" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Выбрать письмо Анна" }));
    expect(screen.getByText("Выбрано: 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Удалить в корзину" })).toBeEnabled();
    const form = container.querySelector('input[name="returnTo"]')!.closest("form")!;
    expect(new FormData(form).getAll("selection")).toHaveLength(1);
    await user.click(screen.getByRole("checkbox", { name: "Выбрать все письма на странице" }));
    expect(new FormData(form).getAll("selection")).toHaveLength(2);
    await user.click(screen.getByRole("checkbox", { name: "Выбрать все письма на странице" }));
    expect(new FormData(form).getAll("selection")).toHaveLength(0);
  });
  it("submits the clicked intent, selected versions and current folder", async () => {
    action.mockClear();
    const user = userEvent.setup();
    render(<MessagesView filters={{ page: 1 }} result={result} />);
    await user.click(screen.getByRole("checkbox", { name: "Выбрать письмо Анна" }));
    await user.click(screen.getByRole("button", { name: "Архивировать" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const submitted = (action.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(submitted.get("intent")).toBe("archive");
    expect(submitted.get("folder")).toBe("INBOX");
    expect(submitted.getAll("selection")).toEqual([JSON.stringify({ id: row.id, updatedAt: row.updatedAt.toISOString() })]);
  });
  it("offers restoration from trash and keeps the folder in filters", () => {
    const { container } = render(<MessagesView filters={{ page: 1, folder: "TRASH" }} result={result} />);
    expect(screen.getByRole("link", { name: "Корзина" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Вернуть во входящие" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Удалить в корзину" })).not.toBeInTheDocument();
    expect(container.querySelector('form[role="search"] input[name="folder"]')).toHaveValue("TRASH");
  });
});
