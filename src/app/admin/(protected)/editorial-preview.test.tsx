import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorialPreview } from "./editorial-preview";

describe("EditorialPreview", () => {
  it("does not load an invalid protocol-relative image from an unsaved field", () => {
    const view = render(<EditorialPreview values={{ title: "Проект", imageUrl: "//external.example/image.jpg" }} />);
    expect(view.container.querySelector("img")).toBeNull();
  });
  it("uses the public card and body with current unsaved values and switches widths", () => {
    const view = render(<EditorialPreview values={{ title: "Новый текст", summary: "Описание карточки", content: "Полный текст" }} />);
    fireEvent.click(screen.getByText("Предпросмотр"));
    expect(view.container.querySelector(".published-card")).toHaveTextContent("Описание карточки");
    expect(view.container.querySelector(".published-body")).toHaveTextContent("Полный текст");
    expect(screen.getByRole("button", { name: "Узкая область" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Широкая область" }));
    expect(screen.getByRole("button", { name: "Широкая область" })).toHaveAttribute("aria-pressed", "true");
    view.rerender(<EditorialPreview values={{ title: "Другая версия", content: "Несохранённый текст" }} />);
    expect(view.container.querySelector(".published-body")).toHaveTextContent("Несохранённый текст");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });
});
