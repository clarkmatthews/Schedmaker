"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ActionError,
  requirePermission,
  requireSession,
  userCanCreateCompanies,
} from "@/lib/permissions";
import { createDefaultRoles } from "@/lib/roles";
import { DEFAULT_TEAM_NAME, firstTeamOptions } from "@/lib/teams";
import { WEEKDAYS, type Weekday } from "@/lib/utils";

export async function listDefinedTeamNames() {
  const user = await requireSession();
  const teams = await prisma.team.findMany({
    where: {
      archived: false,
      company: {
        archived: false,
        directory: { some: { userId: user.id } },
      },
    },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return firstTeamOptions(teams.map((team) => team.name));
}

export async function createCompanyAction(formData: FormData) {
  const user = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC") || "UTC";
  const allowedTeams = await listDefinedTeamNames();
  const teamName = String(formData.get("team") ?? DEFAULT_TEAM_NAME).trim();

  if (!name) {
    return { error: "Company name is required." };
  }
  if (!allowedTeams.includes(teamName)) {
    return { error: "Choose a team from the list." };
  }

  const current = await prisma.user.findUnique({ where: { id: user.id } });
  if (!current) {
    return { error: "Account not found." };
  }
  if (!(await userCanCreateCompanies(current.id, current.support))) {
    return { error: "You do not have permission to create a company." };
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name,
        defaultTimezone: timezone,
        defaultDayWeekStarts: "monday",
      },
    });
    const roles = await createDefaultRoles(tx, created.id);
    const administrator =
      roles.find((role) => role.systemKey === "administrator") ?? roles[roles.length - 1]!;
    await tx.directory.create({
      data: {
        companyId: created.id,
        userId: current.id,
        internalId: "",
        roleId: administrator.id,
      },
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
    await requirePermission(companyId, "company", "edit");
    const name = String(formData.get("name") ?? "").trim();
    const defaultTimezone = String(formData.get("defaultTimezone") ?? "UTC");
    const defaultDayWeekStarts = String(
      formData.get("defaultDayWeekStarts") ?? "monday",
    );
    if (!name) return { error: "Company name is required." };
    if (!WEEKDAYS.includes(defaultDayWeekStarts as Weekday)) {
      return { error: "Choose a valid weekday for week starts." };
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { name, defaultTimezone, defaultDayWeekStarts },
    });
    await prisma.team.updateMany({
      where: { companyId },
      data: { timezone: defaultTimezone, dayWeekStarts: defaultDayWeekStarts },
    });

    revalidatePath(`/app/companies/${companyId}`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    const teams = await prisma.team.findMany({
      where: { companyId },
      select: { id: true },
    });
    for (const team of teams) {
      revalidatePath(`/app/companies/${companyId}/teams/${team.id}/scheduling`);
      revalidatePath(`/app/companies/${companyId}/teams/${team.id}/scheduling/print`);
    }
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update company." };
  }
}

export async function updateSchedulingRulesAction(companyId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "scheduling", "edit");
    const lockHistoricalSchedule = String(formData.get("lockHistoricalSchedule") ?? "") === "true";
    const laborState = String(formData.get("laborState") ?? "").trim().toUpperCase();
    let mealRules: Prisma.InputJsonValue | undefined;
    let overtimeRules: Prisma.InputJsonValue | undefined;
    let minorRules: Prisma.InputJsonValue | undefined;
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
    const rawMinor = String(formData.get("minorRules") ?? "");
    if (rawMinor) {
      try {
        minorRules = JSON.parse(rawMinor) as Prisma.InputJsonValue;
      } catch {
        return { error: "Minor rules could not be saved." };
      }
    }
    await prisma.company.update({
      where: { id: companyId },
      data: {
        lockHistoricalSchedule,
        laborState,
        ...(mealRules !== undefined ? { mealRules } : {}),
        ...(overtimeRules !== undefined ? { overtimeRules } : {}),
        ...(minorRules !== undefined ? { minorRules } : {}),
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
    await requirePermission(companyId, "mms", "edit");
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
