import { formatInTimeZone } from "date-fns-tz";
import { WEEKDAYS, type Weekday } from "@/lib/utils";
import { END_SLOT } from "@/lib/scheduling/time-grid";

export type HoursDay = {
  weekday: Weekday;
  closed: boolean;
  scheduleStartSlot: number;
  scheduleEndSlot: number;
  businessStartSlot: number | null;
  businessEndSlot: number | null;
};

export type HoursTemplateView = {
  id: string;
  name: string;
  days: HoursDay[];
};

export const DEFAULT_SCHEDULE_START = 32;
export const DEFAULT_SCHEDULE_END = END_SLOT;
export const DEFAULT_BUSINESS_START = 40;
export const DEFAULT_BUSINESS_END = 88;

export function defaultHoursDays(): HoursDay[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    closed: false,
    scheduleStartSlot: DEFAULT_SCHEDULE_START,
    scheduleEndSlot: DEFAULT_SCHEDULE_END,
    businessStartSlot: DEFAULT_BUSINESS_START,
    businessEndSlot: DEFAULT_BUSINESS_END,
  }));
}

export function weekdayFromDate(date: Date, timezone?: string): Weekday {
  const name = timezone
    ? formatInTimeZone(date, timezone, "eeee").toLowerCase()
    : WEEKDAYS[date.getDay()];
  return (WEEKDAYS.includes(name as Weekday) ? name : WEEKDAYS[date.getDay()]) as Weekday;
}

export function toHoursTemplateView(template: {
  id: string;
  name: string;
  days: Array<{
    weekday: string;
    closed: boolean;
    scheduleStartSlot: number;
    scheduleEndSlot: number;
    businessStartSlot: number | null;
    businessEndSlot: number | null;
  }>;
}): HoursTemplateView {
  return {
    id: template.id,
    name: template.name,
    days: WEEKDAYS.map((weekday) => {
      const day = template.days.find((item) => item.weekday === weekday);
      return {
        weekday,
        closed: day?.closed ?? false,
        scheduleStartSlot: day?.scheduleStartSlot ?? DEFAULT_SCHEDULE_START,
        scheduleEndSlot: day?.scheduleEndSlot ?? DEFAULT_SCHEDULE_END,
        businessStartSlot: day?.businessStartSlot ?? null,
        businessEndSlot: day?.businessEndSlot ?? null,
      };
    }),
  };
}

export function hoursForDay(
  template: HoursTemplateView | null,
  date: Date,
  timezone?: string,
): HoursDay | null {
  if (!template) return null;
  const weekday = weekdayFromDate(date, timezone);
  return template.days.find((day) => day.weekday === weekday) ?? null;
}

export function visibleRange(day: HoursDay | null) {
  if (!day) {
    return { startSlot: 0, endSlot: END_SLOT };
  }
  const startSlot = Math.min(day.scheduleStartSlot, day.scheduleEndSlot);
  const endSlot = Math.max(day.scheduleStartSlot, day.scheduleEndSlot);
  return {
    startSlot,
    endSlot: endSlot <= startSlot ? END_SLOT : endSlot,
  };
}
