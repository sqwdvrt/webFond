import { describe, expect, it } from "vitest";

import type { DonationRow } from "./types";
import {
  DONATION_CSV_HEADER,
  encodeDonationCsvHeader,
  encodeDonationCsvRows,
} from "./csv";

const row: DonationRow = {
  id: "donation-1",
  providerPaymentId: "payment;\"1\"",
  amountKopecks: 1234567,
  currency: "RUB",
  status: "SUCCEEDED",
  donorName: "Иван\r\nИванов",
  donorEmail: "ivan@example.test",
  paidAt: new Date("2026-08-23T09:40:00.000Z"),
  createdAt: new Date("2026-08-23T09:34:56.000Z"),
};

describe("donation CSV", () => {
  it("uses the exact ten-column header with BOM and CRLF", () => {
    expect(DONATION_CSV_HEADER).toEqual([
      "ID",
      "Дата создания",
      "Сумма",
      "Валюта",
      "Статус",
      "Код статуса",
      "Имя плательщика",
      "Email",
      "ID платежа",
      "Дата оплаты",
    ]);
    expect(encodeDonationCsvHeader()).toBe(
      `\uFEFF${DONATION_CSV_HEADER.map((value) => `"${value}"`).join(";")}\r\n`,
    );
  });

  it("maps every row field deterministically and excludes internal payment keys", () => {
    const csv = encodeDonationCsvRows([row]);

    expect(csv).toBe(
      '"donation-1";"2026-08-23 12:34:56 +03:00";"12345,67";"RUB";"Успешно";"SUCCEEDED";"Иван\r\nИванов";"ivan@example.test";"payment;""1""";"2026-08-23 12:40:00 +03:00"\r\n',
    );
    expect(csv).not.toContain("idempotence");
  });

  it.each([
    "=1+1",
    "+SUM(A1:A2)",
    "-2+3",
    "@command",
    "  =1+1",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
  ])("neutralizes spreadsheet formulas in untrusted cells: %j", (value) => {
    const csv = encodeDonationCsvRows([{ ...row, donorName: value }]);

    expect(csv).toContain(`"'${value.replaceAll('"', '""')}"`);
  });

  it("writes empty nullable fields as quoted empty cells", () => {
    const csv = encodeDonationCsvRows([
      {
        ...row,
        providerPaymentId: null,
        donorName: null,
        donorEmail: null,
        paidAt: null,
      },
    ]);

    expect(
      csv.trimEnd().split(";").filter((cell) => cell === '""'),
    ).toHaveLength(4);
  });

  it("keeps an empty data selection header-only", () => {
    expect(encodeDonationCsvRows([])).toBe("");
  });
});
