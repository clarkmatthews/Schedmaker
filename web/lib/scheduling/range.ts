import { addDays, startOfDay } from "date-fns";
import { WEEKDAYS, type Weekday } from "@/lib/utils";

function weekStartIndex(dayWeekStarts: string) {
  const weekday = (WEEKDAYS.includes(dayWeekStarts as Weekday)
    ? dayWeekStarts
    : "monday") as Weekday;
  return WEEKDAYS.indexOf(weekday);
}

export function weekRange(anchor: Date, dayWeekStarts: string) {
  const startIndex = weekStartIndex(dayWeekStarts);
  const day = startOfDay(anchor);
  const diff = (day.getDay() - startIndex + 7) % 7;
  const start = addDays(day, -diff);
  const end = addDays(start, 7);
  return { start, end };
}

/** Calendar date `yyyy-MM-dd` → first day of that workweek (`yyyy-MM-dd`). */
export function workweekStartKey(dateKey: string, dayWeekStarts: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const startIndex = weekStartIndex(dayWeekStarts);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  const diff = (date.getUTCDay() - startIndex + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

export function dayRange(anchor: Date) {
  const start = startOfDay(anchor);
  return { start, end: addDays(start, 1) };
}

export function parseDateParam(value?: string) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
