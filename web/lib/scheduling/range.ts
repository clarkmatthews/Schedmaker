import { addDays, startOfDay } from "date-fns";
import { WEEKDAYS, type Weekday } from "@/lib/utils";

export function weekRange(anchor: Date, dayWeekStarts: string) {
  const weekday = (WEEKDAYS.includes(dayWeekStarts as Weekday)
    ? dayWeekStarts
    : "monday") as Weekday;
  const startIndex = WEEKDAYS.indexOf(weekday);
  const day = startOfDay(anchor);
  const diff = (day.getDay() - startIndex + 7) % 7;
  const start = addDays(day, -diff);
  const end = addDays(start, 7);
  return { start, end };
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
