import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  let desktopListener: (event: { matches: boolean }) => void;
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: (_: string, listener: typeof desktopListener) => { desktopListener = listener; },
      removeEventListener: vi.fn(),
    })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("renders the brand, primary navigation, and help action", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("link", { name: "Фонд «Быть Добру»" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("img", { name: "Знак фонда «Быть Добру»: руки, росток и птица" }).getAttribute("src"),
    ).toContain("mark-small.webp");
    expect(screen.getByRole("navigation", { name: "Основная" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Нужна помощь" })).toHaveAttribute(
      "href",
      "/need-help",
    );
    expect(screen.getByRole("link", { name: "Документы" })).toHaveAttribute(
      "href",
      "/requisites",
    );
    expect(screen.queryByRole("link", { name: "Новости" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Отчеты" })).not.toBeInTheDocument();
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

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Меню сайта" })).toBeVisible();
    expect(menuButton).toHaveAttribute("aria-controls", screen.getByRole("dialog").id);
    expect(screen.getByRole("button", { name: "Закрыть меню" })).toHaveFocus();
    expect(screen.getByRole("navigation", { name: "Мобильная" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Закрыть меню" }));
    expect(screen.queryByRole("navigation", { name: "Мобильная" })).toBeNull();
  });

  it("cycles keyboard focus between the first and last controls", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    const dialog = screen.getByRole("dialog");
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("link", { name: "Помочь" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Закрыть меню" })).toHaveFocus();
  });

  it("closes the mobile navigation with Escape", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("navigation", { name: "Мобильная" })).toBeNull();
    expect(screen.getByRole("button", { name: "Открыть меню" })).toHaveFocus();
  });

  it("closes on the current link and restores focus and scrolling", async () => {
    vi.mocked(usePathname).mockReturnValue("/about");
    const user = userEvent.setup();
    render(<SiteHeader />);
    const opener = screen.getByRole("button", { name: "Открыть меню" });
    await user.click(opener);
    expect(document.body.style.overflow).toBe("hidden");
    const link = within(screen.getByRole("dialog")).getByRole("link", { name: "О фонде" });
    expect(link).toHaveAttribute("aria-current", "page");
    await user.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes at desktop width and restores the previous overflow on unmount", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    const { unmount } = render(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    act(() => desktopListener({ matches: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    await user.click(screen.getByRole("button", { name: "Открыть меню" }));
    unmount();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
});
