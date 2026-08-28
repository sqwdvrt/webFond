import type { RequisitesInput } from "./types";

const COPY_ROWS: ReadonlyArray<readonly [label: string, key: keyof RequisitesInput]> = [
  ["Полное наименование", "fullName"],
  ["Сокращенное наименование", "shortName"],
  ["ОГРН", "ogrn"],
  ["ИНН", "inn"],
  ["КПП", "kpp"],
  ["Адрес", "address"],
  ["Email", "email"],
  ["Банк", "bankName"],
  ["Получатель", "recipientName"],
  ["Расчетный счет", "checkingAccount"],
  ["Корреспондентский счет", "correspondentAccount"],
  ["БИК", "bik"],
];

export function formatPublishedRequisitesCopy(requisites: RequisitesInput): string {
  return COPY_ROWS.map(([label, key]) => {
    const value = requisites[key];
    const text = key === "email" ? String(value).toLowerCase() : String(value);
    return `${label}: ${text}`;
  }).join("\n");
}
