import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { SLOT_MINUTES, SLOTS_PER_DAY } from "@/lib/scheduling/time-grid";

type Timed = { start: string; stop: string };
type ShiftLike = Timed & {
  userId?: string | null;
  breaks: Timed[];
};

function intervalMs(start: string, stop: string) {
  return Math.max(0, parseISO(stop).getTime() - parseISO(start).getTime());
}

export function overlapMs(
  startMs: number,
  stopMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
) {
  return Math.max(0, Math.min(stopMs, rangeEndMs) - Math.max(startMs, rangeStartMs));
}

export function onClockMs(shift: ShiftLike) {
  const raw = intervalMs(shift.start, shift.stop);
  const breaks = shift.breaks.reduce((sum, item) => sum + intervalMs(item.start, item.stop), 0);
  return Math.max(0, raw - breaks);
}

export function onClockMsInRange(shift: ShiftLike, rangeStart: Date, rangeEnd: Date) {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const raw = overlapMs(
    parseISO(shift.start).getTime(),
    parseISO(shift.stop).getTime(),
    rangeStartMs,
    rangeEndMs,
  );
  const breaks = shift.breaks.reduce(
    (sum, item) =>
      sum +
      overlapMs(
        parseISO(item.start).getTime(),
        parseISO(item.stop).getTime(),
        rangeStartMs,
        rangeEndMs,
      ),
    0,
  );
  return Math.max(0, raw - breaks);
}

export function shiftOverlapsRange(shift: Timed, rangeStart: Date, rangeEnd: Date) {
  return (
    overlapMs(
      parseISO(shift.start).getTime(),
      parseISO(shift.stop).getTime(),
      rangeStart.getTime(),
      rangeEnd.getTime(),
    ) > 0
  );
}

export function sumOnClockMs(shifts: ShiftLike[]) {
  return shifts.reduce((sum, shift) => sum + onClockMs(shift), 0);
}

export function uniqueEmployeeCount(shifts: { userId?: string | null }[]) {
  return new Set(shifts.map((shift) => shift.userId).filter(Boolean)).size;
}

export function formatHours(ms: number) {
  const hours = ms / 3_600_000;
  if (hours <= 0) return "0";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatCurrencyUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function estimatedLaborUsd(
  shifts: Array<{ userId?: string | null; regularMs?: number; otMs?: number }>,
  rates: Record<string, number>,
) {
  return shifts.reduce((sum, shift) => {
    if (!shift.userId) return sum;
    const rate = rates[shift.userId];
    if (!rate || !Number.isFinite(rate) || rate <= 0) return sum;
    const regularHours = (shift.regularMs ?? 0) / 3_600_000;
    const otHours = (shift.otMs ?? 0) / 3_600_000;
    return sum + regularHours * rate + otHours * rate * 1.5;
  }, 0);
}

export function formatHoursOt(regularMs: number, otMs: number, showOt: boolean) {
  if (!showOt) return formatHours(regularMs + otMs);
  return `${formatHours(regularMs)}/${formatHours(otMs)}`;
}

export function slotInstant(day: Date, slot: number, timezone: string) {
  const daysAhead = Math.floor(slot / SLOTS_PER_DAY);
  const slotInDay = slot % SLOTS_PER_DAY;
  const target = addDays(day, daysAhead);
  const minutes = slotInDay * SLOT_MINUTES;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${format(target, "yyyy-MM-dd")}T${hh}:${mm}:00`, timezone);
}
