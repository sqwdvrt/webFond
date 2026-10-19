export type BankQrId = "alfa" | "vtb" | "sber" | "tbank";

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
  ogrn?: string;
  bankInn?: string;
  bankKpp?: string;
  organizationAddress?: string;
  bankAddress?: string;
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

export const bankQrOptions = [
  {
    id: "tbank",
    label: "Т-Банк",
    src: "/qr/tbank.png",
    alt: "QR-код для перевода в приложении Т-Банка",
    recipientName: FUND_RECIPIENT,
    organizationAddress: "109462, РОССИЯ, Г.МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ КУЗЬМИНКИ, Б-Р ВОЛЖСКИЙ, Д. 51, СТР. 17, ПОМЕЩ. 101",
    inn: FUND_INN,
    kpp: FUND_KPP,
    ogrn: "1257700318974",
    bankName: "АО «ТБанк»",
    bankInn: "7710140679",
    bik: "044525974",
    checkingAccount: "40703810700000751955",
    correspondentAccount: "30101810145250000974",
    bankAddress: "127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26",
    paymentPurpose: PAYMENT_PURPOSE,
  },
  {
    id: "sber",
    label: "Сбербанк",
    src: "/qr/sber.png",
    alt: "QR-код для перевода в приложении Сбербанка",
    recipientName: "ФБД",
    inn: FUND_INN,
    kpp: FUND_KPP,
    ogrn: "1257700318974",
    bankName: "СТАВРОПОЛЬСКОЕ ОТДЕЛЕНИЕ N5230 ПАО СБЕРБАНК",
    bik: "040702615",
    checkingAccount: "40703810260670000114",
    correspondentAccount: "30101810907020000615",
    bankInn: "7707083893",
    bankKpp: "151502001",
    paymentPurpose: PAYMENT_PURPOSE,
  },
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
  const rows: Array<readonly [string, string]> = COPY_ROWS.map(
    ([label, key]) => [label, option[key] ?? ""] as const,
  );
  if (option.ogrn) rows.push(["ОГРН", option.ogrn]);
  if (option.bankInn) rows.push(["ИНН банка", option.bankInn]);
  if (option.bankKpp) rows.push(["КПП банка", option.bankKpp]);
  if (option.organizationAddress) rows.push(["Юридический адрес организации", option.organizationAddress]);
  if (option.bankAddress) rows.push(["Юридический адрес банка", option.bankAddress]);
  return rows;
}

export function formatBankQrCopy(option: BankQrOption): string {
  return bankQrDetails(option)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}
