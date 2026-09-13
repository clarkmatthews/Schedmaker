import { addDays, addWeeks, format } from "date-fns";

export const CALENDAR_VIEWS = ["week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function parseView(value?: string): CalendarView {
  return value === "day" ? "day" : "week";
}

export function stepDate(view: CalendarView, date: Date, direction: -1 | 1) {
  return view === "day" ? addDays(date, direction) : addWeeks(date, direction);
}

export function dateParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}
