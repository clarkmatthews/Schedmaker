"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseHourlyRate } from "@/lib/employees";
import { ActionError, assertTeamInCompany, requirePermission } from "@/lib/permissions";

export async function createTeamAction(companyId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "teams", "edit");
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { error: "Company not found." };

    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    if (!name) return { error: "Team name is required." };

    const team = await prisma.team.create({
      data: {
        companyId,
        name,
        timezone: company.defaultTimezone,
        dayWeekStarts: company.defaultDayWeekStarts,
        color,
      },
    });
    revalidatePath(`/app/companies/${companyId}`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const, teamId: team.id };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not create team." };
  }
}

export async function updateTeamAction(
  companyId: string,
  teamId: string,
  formData: FormData,
) {
  try {
    await requirePermission(companyId, "teams", "edit");
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    if (!name) return { error: "Team name is required." };

    await prisma.team.update({
      where: { id: teamId },
      data: { name, color },
    });
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/settings`);
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling`);
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling/print`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update team." };
  }
}

export async function createJobAction(
  companyId: string,
  teamId: string,
  formData: FormData,
) {
  try {
    await requirePermission(companyId, "teams", "edit");
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    const parsedRate = parseHourlyRate(String(formData.get("hourlyRate") ?? ""));
    if (!name) return { error: "Job name is required." };
    if (parsedRate.error) return { error: parsedRate.error };

    await prisma.job.create({
      data: { teamId, name, color, hourlyRate: parsedRate.rate },
    });
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/settings`);
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not create job." };
  }
}

export async function updateJobAction(
  companyId: string,
  teamId: string,
  jobId: string,
  formData: FormData,
) {
  try {
    await requirePermission(companyId, "teams", "edit");
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    const archived = String(formData.get("archived") ?? "") === "true";
    const parsedRate = parseHourlyRate(String(formData.get("hourlyRate") ?? ""));
    if (!name) return { error: "Job name is required." };
    if (parsedRate.error) return { error: parsedRate.error };

    const job = await prisma.job.findFirst({ where: { id: jobId, teamId } });
    if (!job) return { error: "Job not found." };

    await prisma.job.update({
      where: { id: jobId },
      data: { name, color, archived, hourlyRate: parsedRate.rate },
    });
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/settings`);
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling`);
    revalidatePath(`/app/companies/${companyId}/settings`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update job." };
  }
}
