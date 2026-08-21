import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("renders the brand, primary navigation, and help action", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("link", { name: "Фонд «Быть Добру»" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("navigation", { name: "Основная" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Помочь" })[0]).toHaveAttribute(
      "href",
      "/help",
    );
  });

  it("opens and closes the mobile navigation", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const menuButton = screen.getByRole("button", { name: "Открыть меню" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(
      screen.getByRole("button", { name: "Закрыть меню" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Мобильная" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Закрыть меню" }));
    expect(screen.queryByRole("navigation", { name: "Мобильная" })).toBeNull();
  });

  it("closes the mobile navigation with Escape", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Мобильная" })).toBeNull();
  });
});
