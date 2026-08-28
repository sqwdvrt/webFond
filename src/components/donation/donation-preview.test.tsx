import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonationPreview } from "@/components/donation/donation-preview";

describe("DonationPreview", () => {
  it("is visibly unavailable and cannot submit data", () => {
    render(<DonationPreview />);
    expect(screen.getByText("Онлайн-оплата через СБП находится в подключении.")).toBeVisible();
    expect(screen.getByRole("checkbox", {
      name: /согласие на обработку персональных данных/i,
    })).toBeDisabled();
    expect(
      screen.getByRole("link", {
        name: "согласие на обработку персональных данных",
      }),
    ).toHaveAttribute("href", "/personal-data-consent");
    expect(
      screen.getByRole("link", {
        name: "Политикой Фонда в отношении обработки персональных данных",
      }),
    ).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("group")).toBeDisabled();
    for (const amount of ["300 ₽", "500 ₽", "1 000 ₽", "3 000 ₽", "5 000 ₽"]) {
      expect(screen.getByText(amount)).toBeVisible();
    }
    expect(screen.getByLabelText("Другая сумма")).toBeDisabled();
    expect(screen.queryByLabelText(/имя/i)).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Оплатить онлайн" })).toBeDisabled();
  });
});
