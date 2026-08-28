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
    expect(screen.getByRole("button", { name: "Скопировано" })).toBeVisible();
  });
});
