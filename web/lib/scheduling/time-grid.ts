export const SLOTS_PER_DAY = 96;
export const SLOT_MINUTES = 15;
export const MINUTES_PER_DAY = SLOTS_PER_DAY * SLOT_MINUTES;
export const MAX_BREAK_SLOTS = 16;
export const END_SLOT = SLOTS_PER_DAY;

export function snapToSlot(date: Date) {
  const copy = new Date(date);
  const minutes = copy.getHours() * 60 + copy.getMinutes();
  const snapped = Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  const clamped = Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - SLOT_MINUTES);
  copy.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return copy;
}

export function slotIndex(date: Date) {
  const snapped = snapToSlot(date);
  return snapped.getHours() * 4 + Math.floor(snapped.getMinutes() / SLOT_MINUTES);
}

export function dateFromSlot(day: Date, index: number) {
  const copy = new Date(day);
  const clamped = Math.min(Math.max(index, 0), SLOTS_PER_DAY - 1);
  const minutes = clamped * SLOT_MINUTES;
  copy.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return copy;
}

export function formatSlot(index: number) {
  if (index >= SLOTS_PER_DAY) return "12:00 AM";
  const minutes = index * SLOT_MINUTES;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function slotOptions() {
  return Array.from({ length: SLOTS_PER_DAY }, (_, index) => ({
    index,
    label: formatSlot(index),
  }));
}

export function endSlotOptions() {
  return [...slotOptions(), { index: END_SLOT, label: "12:00 AM" }];
}

export function durationSlots(start: Date, stop: Date) {
  return Math.round((stop.getTime() - start.getTime()) / (SLOT_MINUTES * 60 * 1000));
}

export function shiftTimesByDays(start: Date, stop: Date, days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return {
    start: new Date(start.getTime() + ms),
    stop: new Date(stop.getTime() + ms),
  };
}

export function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function barStyle(
  start: Date,
  stop: Date,
  rangeStartSlot = 0,
  rangeEndSlot = END_SLOT,
) {
  const rangeMinutes = Math.max((rangeEndSlot - rangeStartSlot) * SLOT_MINUTES, SLOT_MINUTES);
  const startMin = minutesFromMidnight(start) - rangeStartSlot * SLOT_MINUTES;
  const widthMin = durationSlots(start, stop) * SLOT_MINUTES;
  return {
    left: `${(startMin / rangeMinutes) * 100}%`,
    width: `${Math.max((widthMin / rangeMinutes) * 100, 100 / (rangeEndSlot - rangeStartSlot || 1))}%`,
  };
}

export function slotFromPercent(
  pct: number,
  rangeStartSlot = 0,
  rangeEndSlot = END_SLOT,
) {
  const span = Math.max(rangeEndSlot - rangeStartSlot, 1);
  const column = Math.round(pct * span);
  return Math.min(rangeEndSlot - 1, Math.max(rangeStartSlot, rangeStartSlot + column));
}

export function slotFromClientX(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  rangeStartSlot = 0,
  rangeEndSlot = END_SLOT,
) {
  if (trackWidth <= 0) return rangeStartSlot;
  return slotFromPercent((clientX - trackLeft) / trackWidth, rangeStartSlot, rangeEndSlot);
}
