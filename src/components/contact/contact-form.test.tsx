import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContactForm } from "./contact-form";
import type { ContactFormState } from "@/features/contact/submit";

describe("ContactForm", () => {
  it("requires separate unchecked consent and sends the viewed version", () => {
    const { container } = render(<ContactForm action={async () => ({ status: "idle", message: "" })} />);
    const consent = screen.getByRole("checkbox", { name: /согласие на обработку персональных данных/i });
    expect(consent).not.toBeChecked();
    expect(consent).toBeRequired();
    expect(container.querySelector('input[name="consentVersion"]')).toHaveValue("2026-09-04");
    expect(screen.getByText(/Не указывайте.*здоров/i)).toBeInTheDocument();
  });
  it("hides the honeypot from assistive technology", () => {
    render(
      <ContactForm
        action={async () => ({ status: "idle", message: "" })}
      />,
    );

    const honeypot = document.querySelector('input[name="website"]');
    expect(screen.queryByRole("textbox", { name: "Сайт" })).not.toBeInTheDocument();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });

  it("preserves all text fields after a server error", async () => {
    const user = userEvent.setup();
    render(<ContactForm action={async (_state, data) => ({ status: "error", message: "Согласие устарело", values: { name: String(data.get("name")), email: String(data.get("email")), message: String(data.get("message")) } })} />);
    await user.type(screen.getByLabelText("Имя"), "Анна");
    await user.type(screen.getByLabelText("Электронная почта"), "anna@example.org");
    await user.type(screen.getByLabelText("Сообщение"), "Сохраните это сообщение");
    await user.click(screen.getByRole("checkbox", { name: /согласие на обработку персональных данных/i }));
    await user.click(screen.getByRole("button", { name: "Отправить письмо" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Имя")).toHaveValue("Анна");
    expect(screen.getByLabelText("Электронная почта")).toHaveValue("anna@example.org");
    expect(screen.getByLabelText("Сообщение")).toHaveValue("Сохраните это сообщение");
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
    await user.click(screen.getByRole("checkbox", { name: /согласие на обработку персональных данных/i }));
    await user.click(screen.getByRole("button", { name: "Отправить письмо" }));

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("Сообщение получили. Ответим на указанную почту.");
  });
});
