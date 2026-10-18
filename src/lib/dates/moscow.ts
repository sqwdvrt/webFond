const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const DAY_IN_MILLISECONDS = 86_400_000;

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
  era: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function utcTimestamp(
  parts: CalendarDate,
  time = { hour: 0, minute: 0, second: 0, millisecond: 0 },
) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(
    time.hour,
    time.minute,
    time.second,
    time.millisecond,
  );
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
  return calendarDateFromUtcTimestamp(
    utcTimestamp(parts) + days * DAY_IN_MILLISECONDS,
  );
}

function moscowParts(instant: Date): CalendarDate & {
  hour: number;
  minute: number;
  second: number;
} {
  const formattedParts = moscowFormatter.formatToParts(instant);
  const values = Object.fromEntries(
    formattedParts
      .filter((part) => part.type !== "literal" && part.type !== "era")
      .map((part) => [part.type, Number(part.value)]),
  );
  const era = formattedParts.find((part) => part.type === "era")?.value;

  return {
    year: era === "BC" ? 1 - values.year : values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function moscowOffsetAt(instant: Date) {
  const parts = moscowParts(instant);
  const localAsUtc = utcTimestamp(parts, {
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: instant.getUTCMilliseconds(),
  });
  return localAsUtc - instant.getTime();
}

function isCalendarDate(
  value: CalendarDate,
  expected: CalendarDate,
) {
  return (
    value.year === expected.year &&
    value.month === expected.month &&
    value.day === expected.day
  );
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
  const offsets = new Set([
    moscowOffsetAt(new Date(localAsUtc - DAY_IN_MILLISECONDS)),
    moscowOffsetAt(new Date(localAsUtc + DAY_IN_MILLISECONDS)),
  ]);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = moscowOffsetAt(new Date(instant));
    offsets.add(offset);
    instant = localAsUtc - offset;
  }

  // A skipped midnight has no fixed point: iteration alternates across the
  // gap. Nearby offsets also preserve both candidates for an ambiguous time.
  const firstInstantOnDate = [...offsets]
    .map((offset) => new Date(localAsUtc - offset))
    .sort((left, right) => left.getTime() - right.getTime())
    .find((candidate) => isCalendarDate(moscowParts(candidate), parts));

  return firstInstantOnDate ?? new Date(instant);
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
