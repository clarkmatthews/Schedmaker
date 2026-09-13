import { prisma } from "@/lib/db";
import {
  notifyChangedShift,
  notifyNewShifts,
  notifyRemovedShifts,
} from "@/lib/notifications";
import { weekRange } from "@/lib/scheduling/range";

export { weekRange };

export const MAX_SHIFT_MS = 23 * 60 * 60 * 1000;

export type ShiftLike = {
  userId: string | null;
  published: boolean;
  start: Date;
  stop: Date;
};

export function validateShiftTimes(start: Date, stop: Date) {
  const duration = stop.getTime() - start.getTime();
  if (duration <= 0) {
    throw new Error("Stop must be after start.");
  }
  if (duration > MAX_SHIFT_MS) {
    throw new Error("Shifts exceed the maximum 23 hour duration.");
  }
}

export async function assertNoUserOverlap(params: {
  userId: string | null;
  start: Date;
  stop: Date;
  excludeShiftId?: string;
}) {
  if (!params.userId) return;
  const conflict = await prisma.shift.findFirst({
    where: {
      userId: params.userId,
      ...(params.excludeShiftId ? { id: { not: params.excludeShiftId } } : {}),
      start: { lt: params.stop },
      stop: { gt: params.start },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new Error("This employee already has a shift during that time.");
  }
}

export async function notifyShiftCreated(shift: ShiftLike) {
  if (shift.userId && shift.published && shift.start > new Date()) {
    await notifyNewShifts(shift.userId, [shift]);
  }
}

export async function notifyShiftDeleted(shift: ShiftLike) {
  if (shift.userId && shift.published && shift.start > new Date()) {
    await notifyRemovedShifts(shift.userId, [shift]);
  }
}

export async function notifyShiftUpdated(
  orig: ShiftLike,
  next: ShiftLike,
  suppressNotification = false,
) {
  if (suppressNotification) return;
  const now = new Date();

  if (!orig.published && next.published) {
    if (next.start > now && next.userId) {
      await notifyNewShifts(next.userId, [next]);
    }
    return;
  }

  if (orig.published && !next.published) {
    if (orig.start > now && orig.userId) {
      await notifyRemovedShifts(orig.userId, [orig]);
    }
    return;
  }

  if (!orig.published && !next.published) {
    return;
  }

  if (orig.userId === next.userId) {
    if (orig.userId && next.start > now) {
      await notifyChangedShift(orig.userId, orig, next);
    }
    return;
  }

  if (orig.userId && orig.start > now) {
    await notifyRemovedShifts(orig.userId, [orig]);
  }
  if (next.userId && next.start > now) {
    await notifyNewShifts(next.userId, [next]);
  }
}
