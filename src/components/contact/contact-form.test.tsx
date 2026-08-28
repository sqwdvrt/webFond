import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContactForm } from "./contact-form";
import type { ContactFormState } from "@/features/contact/submit";

describe("ContactForm", () => {
  it("hides the honeypot from assistive technology", () => {
    render(
      <ContactForm
        action={async () => ({ status: "idle", message: "" })}
      />,
    );

    const honeypot = screen.getByRole("textbox", { name: "Сайт", hidden: true });
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });

  it("shows a success status after a human submission", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (
        _state: ContactFormState,
        formData: FormData,
      ): Promise<ContactFormState> => {
        expect(formData.get("name")).toBe("Анна");
        return {
          status: "success",
          message: "Сообщение получили. Ответим на указанную почту.",
        };
      },
    );

    render(<ContactForm action={action} />);

    await user.type(screen.getByLabelText("Имя"), "Анна");
    await user.type(screen.getByLabelText("Электронная почта"), "anna@example.org");
    await user.type(
      screen.getByLabelText("Сообщение"),
      "Хочу узнать, как помочь фонду документами.",
    );
    await user.click(screen.getByRole("button", { name: "Отправить письмо" }));

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("Сообщение получили. Ответим на указанную почту.");
  });
});
