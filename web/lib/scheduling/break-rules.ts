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

function breakFits(
  offsetMinutes: number,
  durationMinutes: number,
  breaks: BreakInputLike[],
  shiftMinutes: number,
) {
  if (offsetMinutes < 0 || offsetMinutes + durationMinutes > shiftMinutes) return false;
  const end = offsetMinutes + durationMinutes;
  return !breaks.some(
    (item) =>
      offsetMinutes < item.offsetMinutes + item.durationMinutes &&
      end > item.offsetMinutes,
  );
}

export function defaultBreakPlacement(
  breaks: BreakInputLike[],
  shiftMinutes: number,
  slotMinutes = SLOT_MINUTES,
): { offsetMinutes: number; durationMinutes: number } | null {
  if (shiftMinutes < 30) {
    const offsetMinutes = firstOpenBreakOffset(breaks, slotMinutes, shiftMinutes);
    if (offsetMinutes == null) return null;
    return { offsetMinutes, durationMinutes: slotMinutes };
  }

  const snap = (minutes: number) => Math.round(minutes / slotMinutes) * slotMinutes;
  const desired = Math.max(0, Math.min(snap((shiftMinutes - 30) / 2), shiftMinutes - 30));

  if (breakFits(desired, 30, breaks, shiftMinutes)) {
    return { offsetMinutes: desired, durationMinutes: 30 };
  }

  const maxOffset = shiftMinutes - 30;
  for (let delta = slotMinutes; delta <= maxOffset; delta += slotMinutes) {
    const left = desired - delta;
    const right = desired + delta;
    if (breakFits(left, 30, breaks, shiftMinutes)) {
      return { offsetMinutes: left, durationMinutes: 30 };
    }
    if (breakFits(right, 30, breaks, shiftMinutes)) {
      return { offsetMinutes: right, durationMinutes: 30 };
    }
  }

  const thirty = firstOpenBreakOffset(breaks, 30, shiftMinutes);
  if (thirty != null) return { offsetMinutes: thirty, durationMinutes: 30 };
  const fifteen = firstOpenBreakOffset(breaks, slotMinutes, shiftMinutes);
  if (fifteen == null) return null;
  return { offsetMinutes: fifteen, durationMinutes: slotMinutes };
}

export { MAX_BREAK_SLOTS };

// Later: BreakCoverage { breakId, responsibilityId, coveringUserId }
// will attach a covering employee to a duty for the duration of a ShiftBreak.
