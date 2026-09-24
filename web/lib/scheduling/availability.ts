import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatSlot } from "@/lib/scheduling/time-grid";

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type UnavailableEntry = {
  id: string;
  userId: string;
  kind: "date" | "weekday";
  weekday: number | null;
  date: string | null;
  allDay: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
};

export type AvailabilityBar = {
  key: string;
  allDay: boolean;
  label: string;
  startSlot: number;
  endSlot: number;
};

type ShiftLike = {
  start: string;
  stop: string;
  userId?: string | null;
};

export function toUnavailableEntry(row: {
  id: string;
  userId: string;
  kind: string;
  weekday: number | null;
  date: Date | null;
  allDay: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
}): UnavailableEntry | null {
  if (row.kind !== "date" && row.kind !== "weekday") return null;
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    weekday: row.weekday,
    date: row.date ? row.date.toISOString().slice(0, 10) : null,
    allDay: row.allDay,
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
  };
}

export function formatMinutes(minutes: number) {
  return formatSlot(minutes / 15);
}

export function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function entrySummary(entry: UnavailableEntry) {
  const hours = entry.allDay
    ? "all day"
    : `${formatMinutes(entry.startMinutes ?? 0)}–${formatMinutes(entry.endMinutes ?? 0)}`;
  if (entry.kind === "weekday") {
    const name = WEEKDAY_NAMES[entry.weekday ?? 0] ?? "that day";
    return `Every ${name}, ${hours}`;
  }
  return `${entry.date ? formatDateKey(entry.date) : "That date"}, ${hours}`;
}

function addDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

function weekdayOfKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

function zonedFromMinutes(dateKey: string, minutes: number, timezone: string) {
  if (minutes >= 24 * 60) {
    return fromZonedTime(`${addDateKey(dateKey, 1)}T00:00:00`, timezone);
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return fromZonedTime(
    `${dateKey}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
    timezone,
  );
}

function applies(entry: UnavailableEntry, dateKey: string) {
  if (entry.kind === "date") return entry.date === dateKey;
  return entry.weekday === weekdayOfKey(dateKey);
}

function windowFor(entry: UnavailableEntry, dateKey: string, timezone: string) {
  if (entry.allDay || entry.startMinutes == null || entry.endMinutes == null) {
    return {
      start: zonedFromMinutes(dateKey, 0, timezone),
      end: zonedFromMinutes(dateKey, 24 * 60, timezone),
    };
  }
  return {
    start: zonedFromMinutes(dateKey, entry.startMinutes, timezone),
    end: zonedFromMinutes(dateKey, entry.endMinutes, timezone),
  };
}

function daysTouched(start: Date, stop: Date, timezone: string) {
  const keys: string[] = [];
  let cursor = formatInTimeZone(start, timezone, "yyyy-MM-dd");
  const endKey = formatInTimeZone(new Date(stop.getTime() - 1), timezone, "yyyy-MM-dd");
  for (let guard = 0; cursor <= endKey && guard < 4; guard += 1) {
    keys.push(cursor);
    cursor = addDateKey(cursor, 1);
  }
  return keys;
}

function warningMessage(entry: UnavailableEntry, dateKey: string) {
  if (entry.kind === "weekday") {
    const name = WEEKDAY_NAMES[entry.weekday ?? 0] ?? "that day";
    if (entry.allDay || entry.startMinutes == null || entry.endMinutes == null) {
      return `Unavailable every ${name}.`;
    }
    return `Unavailable every ${name}, ${formatMinutes(entry.startMinutes)}–${formatMinutes(entry.endMinutes)}.`;
  }
  const label = formatDateKey(dateKey);
  if (entry.allDay || entry.startMinutes == null || entry.endMinutes == null) {
    return `Unavailable on ${label}.`;
  }
  return `Unavailable ${label}, ${formatMinutes(entry.startMinutes)}–${formatMinutes(entry.endMinutes)}.`;
}

export function availabilityBars(
  entries: UnavailableEntry[],
  userId: string,
  day: Date,
  timezone: string,
): AvailabilityBar[] {
  const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
  return entries
    .filter((entry) => entry.userId === userId && applies(entry, dateKey))
    .map((entry) => {
      const allDay = entry.allDay || entry.startMinutes == null || entry.endMinutes == null;
      return {
        key: entry.id,
        allDay,
        label: allDay
          ? "All day"
          : `${formatMinutes(entry.startMinutes!)}–${formatMinutes(entry.endMinutes!)}`,
        startSlot: allDay ? 0 : entry.startMinutes! / 15,
        endSlot: allDay ? 96 : entry.endMinutes! / 15,
      };
    });
}

export function evaluateAvailabilityWarnings(
  shift: ShiftLike,
  entries: UnavailableEntry[],
  timezone: string,
) {
  if (!shift.userId) return [];
  const start = new Date(shift.start);
  const stop = new Date(shift.stop);
  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime()) || stop <= start) return [];
  const dates = daysTouched(start, stop, timezone);
  const warnings: { code: string; message: string }[] = [];
  for (const entry of entries) {
    if (entry.userId !== shift.userId) continue;
    for (const dateKey of dates) {
      if (!applies(entry, dateKey)) continue;
      const window = windowFor(entry, dateKey, timezone);
      if (start < window.end && stop > window.start) {
        warnings.push({ code: "unavailable", message: warningMessage(entry, dateKey) });
        break;
      }
    }
  }
  return warnings;
}
