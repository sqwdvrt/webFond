import { describe, expect, it } from "vitest";

import { bankQrOptions, formatBankQrCopy } from "./bank-qr";

function optionById(id: "tbank" | "alfa" | "vtb") {
  const option = bankQrOptions.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Missing bank QR option ${id}`);
  }
  return option;
}

describe("bank QR catalog", () => {
  it("lists T-Bank, Alfa-Bank and VTB in that order", () => {
    expect(bankQrOptions.map((item) => item.id)).toEqual(["tbank", "alfa", "vtb"]);
  });

  it("formats Alfa copy with its account and BIK, without the T-Bank account", () => {
    const alfa = optionById("alfa");
    const tbank = optionById("tbank");
    const text = formatBankQrCopy(alfa);

    expect(text).toContain(`Получатель: ${alfa.recipientName}`);
    expect(text).toContain(`ИНН: ${alfa.inn}`);
    expect(text).toContain(`Банк: ${alfa.bankName}`);
    expect(text).toContain(`БИК: ${alfa.bik}`);
    expect(text).toContain(`Расчетный счет: ${alfa.checkingAccount}`);
    expect(text).toContain(`Корреспондентский счет: ${alfa.correspondentAccount}`);
    expect(text).toContain(`Назначение платежа: ${alfa.paymentPurpose}`);
    expect(text).not.toContain(tbank.checkingAccount);
    expect(alfa.checkingAccount).not.toBe(tbank.checkingAccount);
  });

  it("publishes the confirmed VTB account, not a placeholder", () => {
    const vtb = optionById("vtb");
    const text = formatBankQrCopy(vtb);

    expect(vtb.recipientName).toBe("ФОНД «БЫТЬ ДОБРУ»");
    expect(vtb.inn).toBe("9721254417");
    expect(vtb.kpp).toBe("772101001");
    expect(vtb.bankName).toBe("ФИЛИАЛ «ЦЕНТРАЛЬНЫЙ» БАНКА ВТБ (ПАО)");
    expect(vtb.bik).toBe("044525411");
    expect(vtb.checkingAccount).toBe("40701810600810019837");
    expect(vtb.correspondentAccount).toBe("30101810145250000411");
    expect(vtb.src).toBe("/qr/vtb.png");
    expect(text).toContain("КПП: 772101001");
    expect(text).toContain("Расчетный счет: 40701810600810019837");
    expect(text).not.toContain("40703810100000000033");
  });

  it("publishes the confirmed Alfa-Bank account, not a placeholder", () => {
    const alfa = optionById("alfa");
    const text = formatBankQrCopy(alfa);

    expect(alfa.recipientName).toBe("ФОНД «БЫТЬ ДОБРУ»");
    expect(alfa.inn).toBe("9721254417");
    expect(alfa.kpp).toBe("772101001");
    expect(alfa.bankName).toBe("ФИЛИАЛ «СТАВРОПОЛЬСКИЙ» АО «АЛЬФА-БАНК»");
    expect(alfa.bik).toBe("040702752");
    expect(alfa.checkingAccount).toBe("40703810256070000014");
    expect(alfa.correspondentAccount).toBe("30101810000000000752");
    expect(alfa.src).toBe("/qr/alfa.png");
    expect(text).toContain("БИК: 040702752");
    expect(text).toContain("Расчетный счет: 40703810256070000014");
    expect(text).not.toContain("40703810400000000022");
  });
});
