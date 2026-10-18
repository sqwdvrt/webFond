import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DonationPreview } from "@/components/donation/donation-preview";

describe("DonationPreview", () => {
  it("shows an honest unavailable status without rendering a fake payment form", () => {
    render(<DonationPreview />);
    expect(screen.getByText("Онлайн-оплата пока недоступна. Вы можете сделать пожертвование банковским переводом.")).toBeVisible();
    expect(screen.queryByText(/скоро|пока платежный сценарий не подключен/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Посмотреть реквизиты" })).toHaveAttribute(
      "href",
      "/requisites",
    );
    expect(screen.getByRole("link", { name: "Написать на почту" })).toHaveAttribute(
      "href",
      "mailto:fbd_2025@mail.ru",
    );
    expect(
      screen.queryByText(/QR-код будет опубликован после подтверждения банковских реквизитов/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Оплатить онлайн" })).not.toBeInTheDocument();
  });
});
