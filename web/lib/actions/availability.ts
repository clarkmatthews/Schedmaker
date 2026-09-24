"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, requireSession } from "@/lib/permissions";
import { assertCanEditAvailability } from "@/lib/availability-access";

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === (month ?? 1) - 1 &&
    date.getUTCDate() === day
  );
}

function parseMinutes(value: string, allowMidnightEnd: boolean) {
  const minutes = Number(value);
  const max = allowMidnightEnd ? 24 * 60 : 24 * 60 - 15;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > max || minutes % 15 !== 0) {
    return null;
  }
  if (!allowMidnightEnd && minutes >= 24 * 60) return null;
  return minutes;
}

async function revalidateForUser(userId: string) {
  revalidatePath("/app/availability");
  const [directory, loans] = await Promise.all([
    prisma.directory.findMany({ where: { userId }, select: { companyId: true } }),
    prisma.employeeLoan.findMany({
      where: { userId, active: true },
      select: { companyId: true },
    }),
  ]);
  const companyIds = new Set([
    ...directory.map((row) => row.companyId),
    ...loans.map((row) => row.companyId),
  ]);
  for (const companyId of companyIds) {
    revalidatePath(`/app/companies/${companyId}`, "layout");
  }
}

export async function createUnavailabilityAction(targetUserId: string, formData: FormData) {
  try {
    const actor = await requireSession();
    await assertCanEditAvailability(actor.id, targetUserId);

    const kind = String(formData.get("kind") ?? "");
    if (kind !== "date" && kind !== "weekday") {
      return { error: "Choose a date or a weekday." };
    }

    const allDay = String(formData.get("allDay") ?? "") === "true";
    let weekday: number | null = null;
    let date: Date | null = null;
    if (kind === "weekday") {
      weekday = Number(formData.get("weekday"));
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return { error: "Choose a day of the week." };
      }
    } else {
      const dateKey = String(formData.get("date") ?? "");
      if (!isDateKey(dateKey)) return { error: "Choose a date." };
      date = new Date(`${dateKey}T00:00:00.000Z`);
    }

    let startMinutes: number | null = null;
    let endMinutes: number | null = null;
    if (!allDay) {
      startMinutes = parseMinutes(String(formData.get("startMinutes") ?? ""), false);
      endMinutes = parseMinutes(String(formData.get("endMinutes") ?? ""), true);
      if (startMinutes == null || endMinutes == null || startMinutes >= endMinutes) {
        return { error: "Choose a start time and a later end time." };
      }
    }

    const duplicate = await prisma.unavailability.findFirst({
      where: {
        userId: targetUserId,
        kind,
        weekday,
        date,
        allDay,
        startMinutes,
        endMinutes,
      },
    });
    if (duplicate) return { error: "That unavailable time is already saved." };

    await prisma.unavailability.create({
      data: {
        userId: targetUserId,
        kind,
        weekday,
        date,
        allDay,
        startMinutes,
        endMinutes,
      },
    });
    await revalidateForUser(targetUserId);
    return {};
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }
}

export async function deleteUnavailabilityAction(entryId: string) {
  try {
    const actor = await requireSession();
    const entry = await prisma.unavailability.findUnique({
      where: { id: entryId },
      select: { id: true, userId: true },
    });
    if (!entry) return { error: "That entry is no longer there." };
    await assertCanEditAvailability(actor.id, entry.userId);
    await prisma.unavailability.delete({ where: { id: entry.id } });
    await revalidateForUser(entry.userId);
    return {};
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }
}
