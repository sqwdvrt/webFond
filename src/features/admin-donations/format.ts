import type { DonationStatusValue } from "./types";

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "longOffset",
});

export const DONATION_STATUS_LABELS: Record<DonationStatusValue, string> = {
  PENDING: "Ожидает",
  SUCCEEDED: "Успешно",
  CANCELED: "Отменено",
};

function decimalParts(amountKopecks: number) {
  const absolute = Math.abs(amountKopecks);
  return {
    sign: amountKopecks < 0 ? "-" : "",
    whole: String(Math.floor(absolute / 100)),
    fraction: String(absolute % 100).padStart(2, "0"),
  };
}

export function formatDonationAmount(
  amountKopecks: number,
  currency: string,
) {
  const { sign, whole, fraction } = decimalParts(amountKopecks);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${fraction} ${currency}`;
}

export function formatDonationCsvAmount(amountKopecks: number) {
  const { sign, whole, fraction } = decimalParts(amountKopecks);
  return `${sign}${whole},${fraction}`;
}

function moscowParts(date: Date) {
  const parts: Record<string, string> = Object.fromEntries(
    dateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const offset = parts.timeZoneName.replace("GMT", "");

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    offset,
  };
}

export function formatDonationDateTime(date: Date | null) {
  if (!date) return "";
  const parts = moscowParts(date);
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function formatDonationCsvDateTime(date: Date | null) {
  if (!date) return "";
  const parts = moscowParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.offset}`;
}

export function moscowDateStamp(date: Date) {
  const parts = moscowParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
