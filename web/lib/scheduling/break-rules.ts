import { MAX_BREAK_SLOTS, SLOT_MINUTES } from "@/lib/scheduling/time-grid";

export type BreakInputLike = {
  offsetMinutes: number;
  durationMinutes: number;
};

export function evaluateBreakRequirements(_shiftMinutes: number) {
  return {
    minBreakSlots: 0,
    suggested: [] as { startSlot: number; durationSlots: number }[],
  };
}

export function breaksOverlap(breaks: BreakInputLike[]) {
  const sorted = [...breaks].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].offsetMinutes < sorted[i - 1].offsetMinutes + sorted[i - 1].durationMinutes) {
      return true;
    }
  }
  return false;
}

export function assertBreaksDoNotOverlap(breaks: { start: Date; stop: Date }[]) {
  const sorted = [...breaks].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start.getTime() < sorted[i - 1].stop.getTime()) {
      throw new Error("Breaks cannot overlap.");
    }
  }
}

export function firstOpenBreakOffset(
  breaks: BreakInputLike[],
  durationMinutes: number,
  shiftMinutes: number,
) {
  const sorted = [...breaks].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  let cursor = 0;
  for (const item of sorted) {
    if (item.offsetMinutes - cursor >= durationMinutes) return cursor;
    cursor = item.offsetMinutes + item.durationMinutes;
  }
  if (shiftMinutes - cursor >= durationMinutes) return cursor;
  return null;
}

export { MAX_BREAK_SLOTS };

// Later: BreakCoverage { breakId, responsibilityId, coveringUserId }
// will attach a covering employee to a duty for the duration of a ShiftBreak.
