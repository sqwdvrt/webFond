import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import NeedHelpPage from "@/app/need-help/page";
import { siteConfig } from "@/config/site";
import { faqItems } from "@/content/faq";

describe("need-help page", () => {
  it("explains who can ask for help and how to apply", () => {
    render(<NeedHelpPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Нужна помощь" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Кто может обратиться" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Какие сведения нужны" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Как подать обращение" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Когда ответим" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Написать через форму" }),
    ).toHaveAttribute("href", "/contacts");
    expect(
      screen.getByRole("link", { name: siteConfig.legal.emailLabel }),
    ).toHaveAttribute("href", `mailto:${siteConfig.legal.emailLabel}`);
    expect(screen.queryByText(/заявки на помощь через сайт не принимаем/i)).not.toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll(".section-number")).map((item) => item.textContent),
    ).toEqual(["01", "02", "03", "04", "05"]);
  });

  it("reveals FAQ answers when a question is opened", async () => {
    const user = userEvent.setup();
    const { container } = render(<NeedHelpPage />);

    expect(container.querySelector(".info-grid")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".faq-list details")).toHaveLength(faqItems.length);

    for (const item of faqItems) {
      expect(screen.getByText(item.question)).toBeVisible();
    }

    const first = container.querySelector(".faq-list details");
    expect(first).toBeInstanceOf(HTMLDetailsElement);
    expect((first as HTMLDetailsElement).open).toBe(false);

    await user.click(screen.getByText(faqItems[0].question));
    expect((first as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText(faqItems[0].answer)).toBeVisible();
    expect(screen.queryByText(/Помощь рядом|Забота о старших|Поддержка детям/)).not.toBeInTheDocument();
  });
});
