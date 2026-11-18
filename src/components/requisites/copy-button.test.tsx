import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CopyRequisitesButton } from "./copy-button";

describe("CopyRequisitesButton", () => {
  it("copies the supplied text and confirms success", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CopyRequisitesButton text="ИНН: 123" />);

    await user.click(screen.getByRole("button", { name: "Скопировать реквизиты" }));

    expect(writeText).toHaveBeenCalledWith("ИНН: 123");
    expect(screen.getByRole("status")).toHaveTextContent("Реквизиты скопированы.");
  });
  it("uses a contextual label and announces which details were copied", async () => {
    const user = userEvent.setup();
    render(<CopyRequisitesButton text="ИНН: 123" label="Скопировать общие реквизиты" successMessage="Общие реквизиты фонда скопированы." />);
    await user.click(screen.getByRole("button", { name: "Скопировать общие реквизиты" }));
    expect(screen.getByRole("status")).toHaveTextContent("Общие реквизиты фонда скопированы.");
  });
  it("offers manual selection if clipboard access fails", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<CopyRequisitesButton text="ИНН: 123" />);
    await user.click(screen.getByRole("button", { name: "Скопировать реквизиты" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Не получилось скопировать. Выделите текст вручную.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
