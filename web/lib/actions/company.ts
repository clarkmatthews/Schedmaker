"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ActionError,
  requireCompanyAdmin,
  requireSession,
} from "@/lib/permissions";

export async function createCompanyAction(formData: FormData) {
  const user = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC") || "UTC";
  const teamName = String(formData.get("team") ?? "Team") || "Team";

  if (!name) {
    return { error: "Company name is required." };
  }

  const current = await prisma.user.findUnique({ where: { id: user.id } });
  if (!current) {
    return { error: "Account not found." };
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name,
        defaultTimezone: timezone,
        defaultDayWeekStarts: "monday",
      },
    });
    await tx.directory.create({
      data: {
        companyId: created.id,
        userId: current.id,
        internalId: "",
      },
    });
    await tx.admin.create({
      data: { companyId: created.id, userId: current.id },
    });
    const team = await tx.team.create({
      data: {
        companyId: created.id,
        name: teamName,
        timezone,
        dayWeekStarts: "monday",
        color: "744FC6",
      },
    });
    await tx.worker.create({
      data: { teamId: team.id, userId: current.id },
    });
    return created;
  });

  revalidatePath("/app");
  return { ok: true as const, companyId: company.id };
}

export async function updateCompanyAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const name = String(formData.get("name") ?? "").trim();
    const defaultTimezone = String(formData.get("defaultTimezone") ?? "UTC");
    const defaultDayWeekStarts = String(
      formData.get("defaultDayWeekStarts") ?? "monday",
    );
    if (!name) return { error: "Company name is required." };

    await prisma.company.update({
      where: { id: companyId },
      data: { name, defaultTimezone, defaultDayWeekStarts },
    });
    revalidatePath(`/app/companies/${companyId}`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update company." };
  }
}

export async function updateSchedulingRulesAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const lockHistoricalSchedule = String(formData.get("lockHistoricalSchedule") ?? "") === "true";
    const laborState = String(formData.get("laborState") ?? "").trim().toUpperCase();
    let mealRules: Prisma.InputJsonValue | undefined;
    let overtimeRules: Prisma.InputJsonValue | undefined;
    const rawRules = String(formData.get("mealRules") ?? "");
    if (rawRules) {
      try {
        mealRules = JSON.parse(rawRules) as Prisma.InputJsonValue;
      } catch {
        return { error: "Meal rules could not be saved." };
      }
    }
    const rawOvertime = String(formData.get("overtimeRules") ?? "");
    if (rawOvertime) {
      try {
        overtimeRules = JSON.parse(rawOvertime) as Prisma.InputJsonValue;
      } catch {
        return { error: "Overtime rules could not be saved." };
      }
    }
    await prisma.company.update({
      where: { id: companyId },
      data: {
        lockHistoricalSchedule,
        laborState,
        ...(mealRules !== undefined ? { mealRules } : {}),
        ...(overtimeRules !== undefined ? { overtimeRules } : {}),
      },
    });
    revalidatePath(`/app/companies/${companyId}`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update scheduling rules." };
  }
}

export async function updateMmsSettingsAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const enabled = String(formData.get("mmsEnabled") ?? "") === "true";
    const accountSid = String(formData.get("mmsAccountSid") ?? "").trim();
    const authToken = String(formData.get("mmsAuthToken") ?? "").trim();
    const fromNumber = String(formData.get("mmsFromNumber") ?? "").trim();
    const managerPhone = String(formData.get("mmsManagerPhone") ?? "").trim();

    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { mmsAuthToken: true },
    });
    if (!existing) return { error: "Company not found." };

    const nextToken = authToken || existing.mmsAuthToken;
    if (enabled) {
      if (!accountSid) return { error: "Twilio Account SID is required." };
      if (!nextToken) return { error: "Twilio Auth Token is required." };
      if (!fromNumber) return { error: "Twilio MMS From number is required." };
      if (!managerPhone) return { error: "Manager on duty phone number is required." };
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        mmsEnabled: enabled,
        mmsAccountSid: accountSid,
        mmsAuthToken: nextToken,
        mmsFromNumber: fromNumber,
        mmsManagerPhone: managerPhone,
      },
    });
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update MMS settings." };
  }
}
