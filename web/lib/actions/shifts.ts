"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, requireCompanyAdmin, requireTeamWorker } from "@/lib/permissions";
import {
  notifyShiftCreated,
  notifyShiftDeleted,
  notifyShiftUpdated,
  validateShiftTimes,
  assertNoUserOverlap,
} from "@/lib/shifts";
import { notifyNewShifts, notifyRemovedShifts } from "@/lib/notifications";
import { notifyPublishedSchedule } from "@/lib/notifications/schedule-mms";
import {
  dateFromSlot,
  durationSlots,
  MAX_BREAK_SLOTS,
  SLOT_MINUTES,
  snapToSlot,
} from "@/lib/scheduling/time-grid";
import { assertBreaksDoNotOverlap } from "@/lib/scheduling/break-rules";
import { assertScheduleDayEditable } from "@/lib/scheduling/schedule-lock";

function emptyId(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export type BreakInput = {
  offsetMinutes: number;
  durationMinutes: number;
};

function parseDays(formData: FormData) {
  const raw = String(formData.get("days") ?? "[]");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
  } catch {
    return [];
  }
}

function parseBreaks(formData: FormData): BreakInput[] {
  const raw = String(formData.get("breaks") ?? "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const row = item as BreakInput;
      return {
        offsetMinutes: Number(row.offsetMinutes),
        durationMinutes: Number(row.durationMinutes),
      };
    });
  } catch {
    throw new Error("Invalid break data.");
  }
}

function parseResponsibilityIds(formData: FormData): string[] {
  const raw = String(formData.get("responsibilityIds") ?? "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((value) => String(value).trim()).filter(Boolean))];
  } catch {
    throw new Error("Invalid responsibility data.");
  }
}

async function assertResponsibilities(
  companyId: string,
  ids: string[],
  alreadyAssigned: string[] = [],
) {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const allowedArchived = new Set(alreadyAssigned);
  const rows = await prisma.responsibility.findMany({
    where: { id: { in: unique }, companyId },
  });
  if (rows.length !== unique.length) {
    throw new Error("Invalid responsibility.");
  }
  for (const row of rows) {
    if (row.archived && !allowedArchived.has(row.id)) {
      throw new Error("That responsibility is archived.");
    }
  }
}

function responsibilityCreates(ids: string[]) {
  return ids.map((responsibilityId) => ({ responsibilityId }));
}

function datesFromSlots(day: Date, startIndex: number, stopIndex: number) {
  const start = snapToSlot(dateFromSlot(day, startIndex));
  let stop = snapToSlot(dateFromSlot(day, stopIndex));
  if (stop <= start) {
    stop = addDays(stop, 1);
  }
  return { start, stop };
}

function parseSlotTimes(formData: FormData, fallbackStart?: Date, fallbackStop?: Date) {
  const dayRaw = String(formData.get("day") ?? "");
  const startSlotRaw = formData.get("startSlot");
  const stopSlotRaw = formData.get("stopSlot");
  if (startSlotRaw != null && stopSlotRaw != null && dayRaw) {
    const day = new Date(`${dayRaw}T00:00:00`);
    return datesFromSlots(day, Number(startSlotRaw), Number(stopSlotRaw));
  }

  const startValue = formData.get("start");
  const stopValue = formData.get("stop");
  const start = snapToSlot(
    startValue ? new Date(String(startValue)) : fallbackStart ?? new Date(),
  );
  const stop = snapToSlot(
    stopValue ? new Date(String(stopValue)) : fallbackStop ?? new Date(),
  );
  return { start, stop };
}

function normalizeBreaks(start: Date, stop: Date, raw: BreakInput[]) {
  const shiftMinutes = durationSlots(start, stop) * SLOT_MINUTES;
  const normalized = raw.map((item) => {
    const offset = Math.round(item.offsetMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    const duration = Math.round(item.durationMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    if (duration < SLOT_MINUTES) {
      throw new Error("Breaks must be at least 15 minutes.");
    }
    if (duration > MAX_BREAK_SLOTS * SLOT_MINUTES) {
      throw new Error("Breaks cannot exceed 4 hours.");
    }
    if (offset < 0 || offset + duration > shiftMinutes) {
      throw new Error("Breaks must sit inside the shift.");
    }
    return {
      start: new Date(start.getTime() + offset * 60 * 1000),
      stop: new Date(start.getTime() + (offset + duration) * 60 * 1000),
    };
  });
  assertBreaksDoNotOverlap(normalized);
  return normalized;
}

function offsetBreaks<T extends { start: Date; stop: Date }>(
  breaks: T[],
  deltaMs: number,
) {
  const next = breaks.map((item) => ({
    start: new Date(item.start.getTime() + deltaMs),
    stop: new Date(item.stop.getTime() + deltaMs),
  }));
  assertBreaksDoNotOverlap(next);
  return next;
}

async function assertJobAndUser(
  companyId: string,
  teamId: string,
  jobId: string | null,
  userId: string | null,
) {
  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, teamId } });
    if (!job) throw new Error("Invalid job.");
  }
  if (userId) {
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!directory) throw new Error("Worker is not in this company.");
    if (directory.deactivated) throw new Error("This employee is deactivated.");
  }
}

function revalidateScheduling(companyId: string, teamId: string) {
  revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling`);
}

export async function createShiftAction(
  companyId: string,
  teamId: string,
  formData: FormData,
) {
  return createShiftsAction(companyId, teamId, formData);
}

export async function createShiftsAction(
  companyId: string,
  teamId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const days = parseDays(formData);
    const fallbackDay = String(formData.get("day") ?? "");
    const targets = days.length ? days : fallbackDay ? [fallbackDay] : [];
    if (!targets.length) {
      const { start, stop } = parseSlotTimes(formData);
      targets.push(
        `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      );
      formData.set("start", start.toISOString());
      formData.set("stop", stop.toISOString());
    }

    const startSlot = Number(formData.get("startSlot") ?? 36);
    const stopSlot = Number(formData.get("stopSlot") ?? 68);
    const jobId = emptyId(formData.get("jobId"));
    const userId = emptyId(formData.get("userId"));
    const published = String(formData.get("published") ?? "") === "true";
    const breakInputs = parseBreaks(formData);
    const responsibilityIds = parseResponsibilityIds(formData);

    await assertJobAndUser(companyId, teamId, jobId, userId);
    await assertResponsibilities(companyId, responsibilityIds);
    const plannedStarts = targets.map(
      (day) => datesFromSlots(new Date(`${day}T00:00:00`), startSlot, stopSlot).start,
    );
    await assertScheduleDayEditable(companyId, teamId, plannedStarts);

    const created = await prisma.$transaction(async (tx) => {
      const shifts = [];
      for (const day of targets) {
        const { start, stop } = datesFromSlots(new Date(`${day}T00:00:00`), startSlot, stopSlot);
        validateShiftTimes(start, stop);
        await assertNoUserOverlap({ userId, start, stop });
        const breaks = normalizeBreaks(start, stop, breakInputs);
        const shift = await tx.shift.create({
          data: {
            teamId,
            jobId,
            userId,
            start,
            stop,
            published,
            breaks: { create: breaks },
            responsibilities: { create: responsibilityCreates(responsibilityIds) },
          },
        });
        shifts.push(shift);
      }
      return shifts;
    });

    for (const shift of created) {
      await notifyShiftCreated(shift);
    }
    revalidateScheduling(companyId, teamId);
    return { ok: true as const, count: created.length };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not create shift." };
  }
}

export async function updateShiftAction(
  companyId: string,
  teamId: string,
  shiftId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const orig = await prisma.shift.findFirst({
      where: { id: shiftId, teamId },
      include: { breaks: true, responsibilities: true },
    });
    if (!orig) return { error: "Shift not found." };

    const { start, stop } = parseSlotTimes(formData, orig.start, orig.stop);
    const jobId = emptyId(formData.get("jobId"));
    const userId = emptyId(formData.get("userId"));
    const published = String(formData.get("published") ?? "") === "true";
    validateShiftTimes(start, stop);
    await assertJobAndUser(companyId, teamId, jobId, userId);
    await assertNoUserOverlap({ userId, start, stop, excludeShiftId: shiftId });
    await assertScheduleDayEditable(companyId, teamId, [orig.start, start]);

    const hasBreaksField = formData.has("breaks");
    const nextBreaks = hasBreaksField
      ? normalizeBreaks(start, stop, parseBreaks(formData))
      : offsetBreaks(orig.breaks, start.getTime() - orig.start.getTime());
    const assignedIds = orig.responsibilities.map((row) => row.responsibilityId);
    const nextResponsibilityIds = formData.has("responsibilityIds")
      ? parseResponsibilityIds(formData)
      : assignedIds;
    await assertResponsibilities(companyId, nextResponsibilityIds, assignedIds);

    const next = await prisma.$transaction(async (tx) => {
      await tx.shiftBreak.deleteMany({ where: { shiftId } });
      await tx.shiftResponsibility.deleteMany({ where: { shiftId } });
      return tx.shift.update({
        where: { id: shiftId },
        data: {
          start,
          stop,
          jobId,
          userId,
          published,
          breaks: { create: nextBreaks },
          responsibilities: { create: responsibilityCreates(nextResponsibilityIds) },
        },
      });
    });

    await notifyShiftUpdated(orig, next);
    revalidateScheduling(companyId, teamId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not update shift." };
  }
}

export async function placeShiftAction(
  companyId: string,
  teamId: string,
  shiftId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const orig = await prisma.shift.findFirst({
      where: { id: shiftId, teamId },
      include: { breaks: true, responsibilities: true },
    });
    if (!orig) return { error: "Shift not found." };

    const copy = String(formData.get("copy") ?? "") === "true";
    const { start, stop } = parseSlotTimes(formData, orig.start, orig.stop);
    const jobId = emptyId(formData.get("jobId"));
    const userId = emptyId(formData.get("userId"));
    validateShiftTimes(start, stop);
    await assertJobAndUser(companyId, teamId, jobId, userId);
    await assertNoUserOverlap({
      userId,
      start,
      stop,
      excludeShiftId: copy ? undefined : shiftId,
    });
    await assertScheduleDayEditable(
      companyId,
      teamId,
      copy ? [start] : [orig.start, start],
    );

    const breaks = offsetBreaks(orig.breaks, start.getTime() - orig.start.getTime());

    const origResponsibilityIds = orig.responsibilities.map((row) => row.responsibilityId);

    if (copy) {
      const created = await prisma.shift.create({
        data: {
          teamId,
          jobId,
          userId,
          start,
          stop,
          published: orig.published,
          breaks: { create: breaks.map(({ start: bStart, stop: bStop }) => ({ start: bStart, stop: bStop })) },
          responsibilities: { create: responsibilityCreates(origResponsibilityIds) },
        },
      });
      await notifyShiftCreated(created);
    } else {
      const next = await prisma.$transaction(async (tx) => {
        await tx.shiftBreak.deleteMany({ where: { shiftId } });
        return tx.shift.update({
          where: { id: shiftId },
          data: {
            start,
            stop,
            jobId,
            userId,
            breaks: { create: breaks.map(({ start: bStart, stop: bStop }) => ({ start: bStart, stop: bStop })) },
          },
        });
      });
      await notifyShiftUpdated(orig, next);
    }

    revalidateScheduling(companyId, teamId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not place shift." };
  }
}

export async function copyShiftAction(
  companyId: string,
  teamId: string,
  shiftId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const orig = await prisma.shift.findFirst({
      where: { id: shiftId, teamId },
      include: { breaks: true, responsibilities: true },
    });
    if (!orig) return { error: "Shift not found." };

    const days = parseDays(formData).filter((day) => {
      const origDay = `${orig.start.getFullYear()}-${String(orig.start.getMonth() + 1).padStart(2, "0")}-${String(orig.start.getDate()).padStart(2, "0")}`;
      return day !== origDay;
    });
    if (!days.length) return { error: "Select at least one other day to copy." };

    const startSlot = orig.start.getHours() * 4 + Math.floor(orig.start.getMinutes() / 15);
    const stopSlot = orig.stop.getHours() * 4 + Math.floor(orig.stop.getMinutes() / 15);
    const relativeBreaks = orig.breaks.map((item) => ({
      offsetMinutes: Math.round((item.start.getTime() - orig.start.getTime()) / 60000),
      durationMinutes: Math.round((item.stop.getTime() - item.start.getTime()) / 60000),
    }));

    const plannedStarts = days.map(
      (day) => datesFromSlots(new Date(`${day}T00:00:00`), startSlot, stopSlot).start,
    );
    await assertScheduleDayEditable(companyId, teamId, plannedStarts);

    const created = await prisma.$transaction(async (tx) => {
      const shifts = [];
      for (const day of days) {
        const { start, stop } = datesFromSlots(new Date(`${day}T00:00:00`), startSlot, stopSlot);
        validateShiftTimes(start, stop);
        await assertNoUserOverlap({ userId: orig.userId, start, stop });
        const breaks = normalizeBreaks(start, stop, relativeBreaks);
        shifts.push(
          await tx.shift.create({
            data: {
              teamId,
              jobId: orig.jobId,
              userId: orig.userId,
              start,
              stop,
              published: orig.published,
              breaks: { create: breaks },
              responsibilities: {
                create: responsibilityCreates(
                  orig.responsibilities.map((row) => row.responsibilityId),
                ),
              },
            },
          }),
        );
      }
      return shifts;
    });

    for (const shift of created) {
      await notifyShiftCreated(shift);
    }
    revalidateScheduling(companyId, teamId);
    return { ok: true as const, count: created.length };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not copy shift." };
  }
}

export async function deleteShiftAction(
  companyId: string,
  teamId: string,
  shiftId: string,
) {
  try {
    await requireTeamWorker(companyId, teamId);
    const orig = await prisma.shift.findFirst({
      where: { id: shiftId, teamId },
    });
    if (!orig) return { error: "Shift not found." };
    await assertScheduleDayEditable(companyId, teamId, [orig.start]);
    await prisma.shift.delete({ where: { id: shiftId } });
    await notifyShiftDeleted(orig);
    revalidateScheduling(companyId, teamId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not delete shift." };
  }
}

export async function bulkPublishShiftsAction(
  companyId: string,
  teamId: string,
  published: boolean,
  startIso: string,
  endIso: string,
) {
  try {
    await requireCompanyAdmin(companyId);
    const start = new Date(startIso);
    const end = new Date(endIso);
    const shifts = await prisma.shift.findMany({
      where: { teamId, start: { gte: start, lt: end } },
    });
    await assertScheduleDayEditable(
      companyId,
      teamId,
      shifts.map((shift) => shift.start),
    );

    const now = new Date();
    const notifs = new Map<string, typeof shifts>();
    for (const shift of shifts) {
      if (shift.userId && shift.published !== published && shift.start > now) {
        const list = notifs.get(shift.userId) ?? [];
        list.push(shift);
        notifs.set(shift.userId, list);
      }
    }

    await prisma.shift.updateMany({
      where: { teamId, start: { gte: start, lt: end } },
      data: { published },
    });

    for (const [userId, userShifts] of notifs) {
      if (published) {
        await notifyNewShifts(userId, userShifts);
        await notifyPublishedSchedule({
          companyId,
          teamId,
          userId,
          rangeStart: start,
        });
      } else {
        await notifyRemovedShifts(userId, userShifts);
      }
    }

    revalidateScheduling(companyId, teamId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError || error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Could not publish shifts." };
  }
}
