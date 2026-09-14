import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { WEEKDAYS, type Weekday } from "@/lib/utils";
import { END_SLOT, SLOT_MINUTES, SLOTS_PER_DAY, formatSlot } from "@/lib/scheduling/time-grid";

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

export function weekdayFromDateKey(dateKey: string): Weekday {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return WEEKDAYS[0];
  const utcNoon = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return WEEKDAYS[utcNoon.getUTCDay()] as Weekday;
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

export function hoursForDateKey(
  template: HoursTemplateView | null,
  dateKey: string,
): HoursDay | null {
  if (!template) return null;
  const weekday = weekdayFromDateKey(dateKey);
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

export type ScheduleWindow = {
  startSlot: number;
  endSlot: number;
  closedDateKeys: string[];
  openDays: number;
};

export function scheduleWindowForDateKeys(
  template: HoursTemplateView | null,
  dateKeys: string[],
): ScheduleWindow | null {
  if (!template) return null;
  const closedDateKeys: string[] = [];
  let startSlot = 0;
  let endSlot = END_SLOT;
  let openDays = 0;
  for (const key of dateKeys) {
    const hours = hoursForDateKey(template, key);
    if (!hours || hours.closed) {
      closedDateKeys.push(key);
      continue;
    }
    openDays += 1;
    const range = visibleRange(hours);
    startSlot = Math.max(startSlot, range.startSlot);
    endSlot = Math.min(endSlot, range.endSlot);
  }
  return { startSlot, endSlot, closedDateKeys, openDays };
}

export function clampSlotsToWindow(
  startSlot: number,
  stopSlot: number,
  window: { startSlot: number; endSlot: number } | null,
) {
  if (!window || window.endSlot <= window.startSlot) {
    return { startSlot, stopSlot };
  }
  const normalizedStop = stopSlot === 0 && startSlot > 0 ? END_SLOT : stopSlot;
  const nextStart = Math.min(Math.max(startSlot, window.startSlot), window.endSlot - 1);
  const nextStop = Math.min(Math.max(normalizedStop, nextStart + 1), window.endSlot);
  return { startSlot: nextStart, stopSlot: nextStop };
}

function titleCaseWeekday(weekday: Weekday) {
  return weekday.slice(0, 1).toUpperCase() + weekday.slice(1);
}

function instantOnDate(dateKey: string, slot: number, timezone: string) {
  const extraDays = Math.floor(slot / SLOTS_PER_DAY);
  const slotInDay = slot % SLOTS_PER_DAY;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return fromZonedTime(`${dateKey}T00:00:00`, timezone);
  }
  const base = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + extraDays));
  const key = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
  const minutes = slotInDay * SLOT_MINUTES;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${key}T${hh}:${mm}:00`, timezone);
}

export function assertShiftWithinHours(
  template: HoursTemplateView | null,
  start: Date,
  stop: Date,
  timezone: string,
) {
  if (!template) return;
  const dateKey = formatInTimeZone(start, timezone, "yyyy-MM-dd");
  const hours = hoursForDateKey(template, dateKey);
  if (!hours) return;
  if (hours.closed) {
    throw new Error(
      `Shifts cannot be scheduled on ${titleCaseWeekday(hours.weekday)} because the location is closed.`,
    );
  }
  const range = visibleRange(hours);
  const earliest = instantOnDate(dateKey, range.startSlot, timezone);
  const latest = instantOnDate(dateKey, range.endSlot, timezone);
  if (start.getTime() < earliest.getTime() || stop.getTime() > latest.getTime()) {
    throw new Error(
      `Scheduled time must be between ${formatSlot(range.startSlot)} and ${formatSlot(range.endSlot)}.`,
    );
  }
}
