import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { bankQrOptions, formatBankQrCopy } from "@/content/bank-qr";

import { BankQrTransfer } from "./bank-qr-transfer";

function optionById(id: "alfa" | "vtb") {
  const option = bankQrOptions.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Missing bank QR option ${id}`);
  }
  return option;
}

describe("BankQrTransfer", () => {
  it("shows Alfa-Bank and VTB choices and no QR or account until a bank is selected", () => {
    render(<BankQrTransfer />);

    expect(screen.getByRole("group", { name: "Банк" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Т-Банк" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Альфа-Банк" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "ВТБ" })).not.toBeChecked();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Расчетный счет")).not.toBeInTheDocument();
    expect(
      screen.getByText("Выберите банк, чтобы показать QR-код и реквизиты"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей (СБП).",
      ),
    ).toBeVisible();
  });

  it("shows Alfa QR, requisites and copy after selecting Alfa, then switches to VTB", async () => {
    const user = userEvent.setup();
    const alfa = optionById("alfa");
    const vtb = optionById("vtb");
    render(<BankQrTransfer />);

    await user.click(screen.getByRole("radio", { name: "Альфа-Банк" }));

    const alfaImage = screen.getByRole("img", { name: alfa.alt });
    expect(alfaImage).toHaveAttribute("src", alfa.src);
    expect(screen.getByText(alfa.checkingAccount)).toBeVisible();
    expect(screen.getByText(alfa.bik)).toBeVisible();
    expect(screen.getByRole("button", { name: "Скопировать реквизиты" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Сохранить QR" })).toHaveAttribute("href", alfa.src);
    expect(screen.getByRole("link", { name: "оферты" })).toHaveAttribute("href", "/donation-offer");
    expect(screen.queryByText(vtb.checkingAccount)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Скопировать реквизиты" }));
    expect(screen.getByRole("button", { name: "Скопировано" })).toBeVisible();

    await user.click(screen.getByRole("radio", { name: "ВТБ" }));

    expect(screen.getByRole("button", { name: "Скопировать реквизиты" })).toBeVisible();
    expect(screen.getByRole("img", { name: vtb.alt })).toHaveAttribute("src", vtb.src);
    expect(screen.getByText(vtb.checkingAccount)).toBeVisible();
    expect(screen.queryByText(alfa.checkingAccount)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сохранить QR" })).toHaveAttribute("href", vtb.src);
  });

  it("shows Sberbank QR and all supplied requisites", async () => {
    const user = userEvent.setup();
    render(<BankQrTransfer />);
    await user.click(screen.getByRole("radio", { name: "Сбербанк" }));

    expect(screen.getByRole("img", { name: "QR-код для перевода в приложении Сбербанка" }))
      .toHaveAttribute("src", "/qr/sber.png");
    for (const value of [
      "ФБД", "9721254417", "772101001", "1257700318974",
      "40703810260670000114", "СТАВРОПОЛЬСКОЕ ОТДЕЛЕНИЕ N5230 ПАО СБЕРБАНК",
      "040702615", "30101810907020000615", "7707083893", "151502001",
    ]) {
      expect(screen.getByText(value)).toBeVisible();
    }
    const sber = bankQrOptions.find((option) => option.id === "sber")!;
    expect(formatBankQrCopy(sber)).toContain("ИНН банка: 7707083893");
    expect(formatBankQrCopy(sber)).toContain("КПП банка: 151502001");
    expect(formatBankQrCopy(sber)).toContain("ОГРН: 1257700318974");
    expect(screen.getByRole("link", { name: "Сохранить QR" }))
      .toHaveAttribute("href", "/qr/sber.png");
  });

  it("shows the confirmed T-Bank account, addresses and QR", async () => {
    const user = userEvent.setup();
    render(<BankQrTransfer />);
    await user.click(screen.getByRole("radio", { name: "Т-Банк" }));
    expect(screen.getByRole("img", { name: "QR-код для перевода в приложении Т-Банка" }))
      .toHaveAttribute("src", "/qr/tbank.png");
    const bank = bankQrOptions.find((option) => option.id === "tbank")!;
    for (const value of [bank.recipientName, bank.organizationAddress, bank.inn,
      bank.kpp, bank.ogrn, bank.checkingAccount, bank.bankName, bank.bankInn,
      bank.bik, bank.correspondentAccount, bank.bankAddress]) {
      expect(screen.getByText(value)).toBeVisible();
      expect(formatBankQrCopy(bank)).toContain(value);
    }
    expect(screen.queryByText("40703810700000000011")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сохранить QR" }))
      .toHaveAttribute("href", "/qr/tbank.png");
  });

  it("has no serious accessibility violations", async () => {
    const { container } = render(
      <main>
        <h1>Помочь фонду</h1>
        <BankQrTransfer />
      </main>,
    );
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const violations = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(violations).toEqual([]);
  });
});
