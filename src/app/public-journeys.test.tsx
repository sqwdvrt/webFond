import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ContactsPage from "@/app/contacts/page";
import NeedHelpPage from "@/app/need-help/page";
import { renderHelpPage } from "@/app/help/page";
import { HomeEvidence } from "@/components/content/home-evidence";

vi.mock("@/app/contacts/actions", () => ({ submitContactAction: vi.fn() }));

describe("public journeys", () => {
  it("takes applicants directly to the form before contact details", () => {
    render(<NeedHelpPage />);
    expect(screen.getByRole("link", { name: "Написать через форму" })).toHaveAttribute("href", "/contacts#contact-form");
    cleanup();
    const { container } = render(<ContactsPage />);
    const target = container.querySelector("#contact-form");
    const details = container.querySelector(".contact-details");
    expect(target).toContainElement(screen.getByRole("form"));
    expect(target!.compareDocumentPosition(details!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps donor questions off the applicant page", () => {
    render(<NeedHelpPage />);
    expect(screen.getByText("Можно ли обратиться за близкого человека?")).toBeVisible();
    expect(screen.queryByText("Как расходуются пожертвования?")).not.toBeInTheDocument();
  });

  it("discloses alternative bank transfer without losing the selected donation project", async () => {
    const user = userEvent.setup();
    const { container } = render(renderHelpPage({ paymentsEnabled: () => true, projects: [{ slug: "published", title: "Проект" }], initialProjectSlug: "published" }));
    const transfer = container.querySelector("details.bank-transfer-disclosure") as HTMLDetailsElement;
    expect(transfer).not.toBeNull();
    expect(transfer.open).toBe(false);
    expect(screen.getByRole("link", { name: "Полные банковские реквизиты" })).toBeVisible();
    await user.click(screen.getByText("Перевести через приложение банка"));
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).toBeVisible();
    expect(screen.getByLabelText("Назначение пожертвования")).toHaveValue("published");
    expect(container.querySelector("#donation-faq")).toContainElement(screen.getByText("Как расходуются пожертвования?"));
  });

  it.each([false, "error"])("keeps bank transfer expanded when payment availability is %s", (availability) => {
    const { container } = render(renderHelpPage({ paymentsEnabled: () => {
      if (availability === "error") throw new Error("private config");
      return false;
    } }));
    expect((container.querySelector("details.bank-transfer-disclosure") as HTMLDetailsElement)?.open).toBe(true);
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Оплатить онлайн" })).not.toBeInTheDocument();
  });

  it("omits empty collections from the homepage without treating load errors as empty", () => {
    const { container } = render(<HomeEvidence data={{ projects: [], documents: [] }} />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    render(<HomeEvidence data={{ projects: null, documents: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Не удалось загрузить проекты.");
  });
});
