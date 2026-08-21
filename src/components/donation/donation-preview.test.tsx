import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonationPreview } from "@/components/donation/donation-preview";

describe("DonationPreview", () => {
  it("is visibly unavailable and cannot submit data", () => {
    render(<DonationPreview />);
    expect(screen.getByText("СБП подключается.").parentElement).toHaveTextContent(
      "СБП подключается. Платежи на сайте пока недоступны.",
    );
    expect(screen.getByRole("group")).toBeDisabled();
    for (const amount of ["300 ₽", "500 ₽", "1 000 ₽", "3 000 ₽", "5 000 ₽"]) {
      expect(screen.getByText(amount)).toBeVisible();
    }
    expect(screen.getByLabelText("Другая сумма")).toBeDisabled();
    expect(screen.queryByLabelText(/имя/i)).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /оплатить/i })).toBeNull();
    expect(screen.getByText("Онлайн-оплата скоро будет доступна")).toBeVisible();
  });
});
