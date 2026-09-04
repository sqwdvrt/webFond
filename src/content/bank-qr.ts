export type BankQrId = "alfa" | "vtb";

export type BankQrOption = {
  id: BankQrId;
  label: string;
  src: string;
  alt: string;
  recipientName: string;
  inn: string;
  kpp: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  correspondentAccount: string;
  paymentPurpose: string;
};

const COPY_ROWS: ReadonlyArray<readonly [label: string, key: keyof BankQrOption]> = [
  ["Получатель", "recipientName"],
  ["ИНН", "inn"],
  ["КПП", "kpp"],
  ["Банк", "bankName"],
  ["БИК", "bik"],
  ["Расчетный счет", "checkingAccount"],
  ["Корреспондентский счет", "correspondentAccount"],
  ["Назначение платежа", "paymentPurpose"],
];

const FUND_RECIPIENT = "ФОНД «БЫТЬ ДОБРУ»";
const FUND_INN = "9721254417";
const FUND_KPP = "772101001";
const PAYMENT_PURPOSE = "Пожертвование на уставную деятельность";

// Temporarily unpublished. Restore by putting this object first in bankQrOptions.
export const unpublishedTbankQr = {
  id: "tbank",
  label: "Т-Банк",
  src: "/qr/tbank.png",
  alt: "QR-код для перевода в приложении Т-Банка",
  recipientName: FUND_RECIPIENT,
  inn: FUND_INN,
  kpp: FUND_KPP,
  bankName: "АО «ТБанк»",
  bik: "044525974",
  checkingAccount: "40703810700000000011",
  correspondentAccount: "30101810145250000974",
  paymentPurpose: PAYMENT_PURPOSE,
} as const;

export const bankQrOptions = [
  {
    id: "alfa",
    label: "Альфа-Банк",
    src: "/qr/alfa.png",
    alt: "QR-код для перевода в приложении Альфа-Банка",
    recipientName: FUND_RECIPIENT,
    inn: FUND_INN,
    kpp: FUND_KPP,
    bankName: "ФИЛИАЛ «СТАВРОПОЛЬСКИЙ» АО «АЛЬФА-БАНК»",
    bik: "040702752",
    checkingAccount: "40703810256070000014",
    correspondentAccount: "30101810000000000752",
    paymentPurpose: PAYMENT_PURPOSE,
  },
  {
    id: "vtb",
    label: "ВТБ",
    src: "/qr/vtb.png",
    alt: "QR-код для перевода в приложении ВТБ",
    recipientName: FUND_RECIPIENT,
    inn: FUND_INN,
    kpp: FUND_KPP,
    bankName: "ФИЛИАЛ «ЦЕНТРАЛЬНЫЙ» БАНКА ВТБ (ПАО)",
    bik: "044525411",
    checkingAccount: "40701810600810019837",
    correspondentAccount: "30101810145250000411",
    paymentPurpose: PAYMENT_PURPOSE,
  },
] as const satisfies readonly BankQrOption[];

export function bankQrDetails(option: BankQrOption): ReadonlyArray<readonly [string, string]> {
  return COPY_ROWS.map(([label, key]) => [label, option[key]] as const);
}

export function formatBankQrCopy(option: BankQrOption): string {
  return bankQrDetails(option)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}
