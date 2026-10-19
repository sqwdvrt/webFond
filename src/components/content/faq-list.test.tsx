import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

import { FaqList } from "./faq-list";

const items = [{ question: "Вопрос", answer: "Ответ" }];
afterEach(() => vi.unstubAllGlobals());

describe("FaqList", () => {
  it("keeps content open until closing finishes and supports reversing a close", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const animations: Array<{ cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }> = [];
    const { container } = render(<FaqList items={items} />);
    const details = container.querySelector("details")!;
    details.animate = vi.fn(() => {
      const animation = { cancel: vi.fn(), onfinish: null };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    fireEvent.click(screen.getByText("Вопрос"));
    expect(details.open).toBe(true);
    animations[0].onfinish!();
    fireEvent.click(screen.getByText("Вопрос"));
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByText("Вопрос"));
    expect(animations[1].cancel).toHaveBeenCalled();
    animations[2].onfinish!();
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByText("Вопрос"));
    animations[3].onfinish!();
    expect(details.open).toBe(false);
  });

  it("toggles immediately when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { container } = render(<FaqList items={items} />);
    const details = container.querySelector("details")!;
    details.animate = vi.fn();
    fireEvent.click(screen.getByText("Вопрос"));
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByText("Вопрос"));
    expect(details.open).toBe(false);
    expect(details.animate).not.toHaveBeenCalled();
  });
});
