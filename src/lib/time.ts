const PACIFIC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles"
});

const PACIFIC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles"
});

export function parseWsdotDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = /\/Date\((-?\d+)(?:[+-]\d+)?\)\//.exec(value);
  if (match) {
    return new Date(Number(match[1]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTime(value?: Date | string | null) {
  const date = value instanceof Date ? value : parseWsdotDate(value);
  return date ? PACIFIC_FORMATTER.format(date) : "";
}

export function formatDateTime(value?: Date | string | null) {
  const date = value instanceof Date ? value : parseWsdotDate(value);
  return date ? PACIFIC_DATE_TIME_FORMATTER.format(date) : "";
}

export function minutesUntil(value?: Date | string | null) {
  const date = value instanceof Date ? value : parseWsdotDate(value);
  if (!date) {
    return null;
  }

  return Math.round((date.getTime() - Date.now()) / 60000);
}

export function relativeMinutes(value?: Date | string | null) {
  const minutes = minutesUntil(value);
  if (minutes === null) {
    return "";
  }

  if (minutes < -1) {
    return `${Math.abs(minutes)} min ago`;
  }

  if (minutes <= 1) {
    return "now";
  }

  return `in ${minutes} min`;
}
