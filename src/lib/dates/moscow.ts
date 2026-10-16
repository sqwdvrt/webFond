const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOSCOW_TIME_ZONE = "Europe/Moscow";

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type UtcInterval = {
  start: Date;
  end: Date;
};

export type MoscowDateRange = {
  fromUtc?: Date;
  toExclusiveUtc?: Date;
};

const moscowFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function utcTimestamp(parts: CalendarDate) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function calendarDateFromUtcTimestamp(timestamp: number): CalendarDate {
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addCalendarDays(parts: CalendarDate, days: number) {
  return calendarDateFromUtcTimestamp(utcTimestamp(parts) + days * 86_400_000);
}

function moscowParts(instant: Date): CalendarDate & {
  hour: number;
  minute: number;
  second: number;
} {
  const values = Object.fromEntries(
    moscowFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function moscowOffsetAt(instant: Date) {
  const parts = moscowParts(instant);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - instant.getTime();
}

export function parseCalendarDate(value: string): CalendarDate | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (parts.year === 0) return null;

  const normalized = calendarDateFromUtcTimestamp(utcTimestamp(parts));
  return normalized.year === parts.year &&
    normalized.month === parts.month &&
    normalized.day === parts.day
    ? parts
    : null;
}

export function moscowStartOfDate(parts: CalendarDate) {
  const localAsUtc = utcTimestamp(parts);
  let instant = localAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = localAsUtc - moscowOffsetAt(new Date(instant));
  }

  return new Date(instant);
}

export function moscowDateRange(
  from?: string,
  to?: string,
): MoscowDateRange | null {
  const fromParts = from ? parseCalendarDate(from) : null;
  const toParts = to ? parseCalendarDate(to) : null;
  if ((from && !fromParts) || (to && !toParts)) return null;

  const fromUtc = fromParts ? moscowStartOfDate(fromParts) : undefined;
  const toExclusiveUtc = toParts
    ? moscowStartOfDate(addCalendarDays(toParts, 1))
    : undefined;
  if (fromUtc && toExclusiveUtc && fromUtc >= toExclusiveUtc) return null;

  return {
    ...(fromUtc ? { fromUtc } : {}),
    ...(toExclusiveUtc ? { toExclusiveUtc } : {}),
  };
}

export function moscowDayInterval(instant: Date): UtcInterval {
  const { year, month, day } = moscowParts(instant);
  const date = { year, month, day };
  return {
    start: moscowStartOfDate(date),
    end: moscowStartOfDate(addCalendarDays(date, 1)),
  };
}

export function moscowMonthInterval(instant: Date): UtcInterval {
  const { year, month } = moscowParts(instant);
  const start = { year, month, day: 1 };
  const nextMonth = calendarDateFromUtcTimestamp(
    utcTimestamp({ year, month: month + 1, day: 1 }),
  );
  return {
    start: moscowStartOfDate(start),
    end: moscowStartOfDate(nextMonth),
  };
}
