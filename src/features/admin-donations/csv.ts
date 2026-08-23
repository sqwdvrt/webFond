import {
  DONATION_STATUS_LABELS,
  formatDonationCsvAmount,
  formatDonationCsvDateTime,
} from "./format";
import type { DonationRow } from "./types";

export const DONATION_CSV_HEADER = [
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
] as const;

function neutralizeFormula(value: string) {
  return /^[\t\r\n]/.test(value) || /^[\s\u0000-\u001f]*[=+\-@]/.test(value)
    ? `'${value}`
    : value;
}

function quote(value: string, untrusted = false) {
  const protectedValue = untrusted ? neutralizeFormula(value) : value;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function encodeDonationCsvHeader() {
  return `\uFEFF${DONATION_CSV_HEADER.map((value) => quote(value)).join(";")}\r\n`;
}

function encodeDonationCsvRow(row: DonationRow) {
  return [
    quote(row.id, true),
    quote(formatDonationCsvDateTime(row.createdAt)),
    quote(formatDonationCsvAmount(row.amountKopecks)),
    quote(row.currency, true),
    quote(DONATION_STATUS_LABELS[row.status]),
    quote(row.status),
    quote(row.donorName ?? "", true),
    quote(row.donorEmail ?? "", true),
    quote(row.providerPaymentId ?? "", true),
    quote(formatDonationCsvDateTime(row.paidAt)),
  ].join(";");
}

export function encodeDonationCsvRows(rows: DonationRow[]) {
  return rows.length
    ? `${rows.map((row) => encodeDonationCsvRow(row)).join("\r\n")}\r\n`
    : "";
}
