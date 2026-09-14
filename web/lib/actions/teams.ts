"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, assertTeamInCompany, requireCompanyAdmin } from "@/lib/permissions";

export async function createTeamAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { error: "Company not found." };

    const name = String(formData.get("name") ?? "").trim();
    const timezone = String(formData.get("timezone") ?? company.defaultTimezone);
    const dayWeekStarts = String(
      formData.get("dayWeekStarts") ?? company.defaultDayWeekStarts,
    );
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    if (!name) return { error: "Team name is required." };

    const team = await prisma.team.create({
      data: { companyId, name, timezone, dayWeekStarts, color },
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
    await requireCompanyAdmin(companyId);
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const timezone = String(formData.get("timezone") ?? "UTC");
    const dayWeekStarts = String(formData.get("dayWeekStarts") ?? "monday");
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    if (!name) return { error: "Team name is required." };

    await prisma.team.update({
      where: { id: teamId },
      data: { name, timezone, dayWeekStarts, color },
    });
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/settings`);
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
    await requireCompanyAdmin(companyId);
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    if (!name) return { error: "Job name is required." };

    await prisma.job.create({ data: { teamId, name, color } });
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
    await requireCompanyAdmin(companyId);
    await assertTeamInCompany(companyId, teamId);
    const name = String(formData.get("name") ?? "").trim();
    const color = String(formData.get("color") ?? "48B7AB").replace("#", "");
    const archived = String(formData.get("archived") ?? "") === "true";
    if (!name) return { error: "Job name is required." };

    const job = await prisma.job.findFirst({ where: { id: jobId, teamId } });
    if (!job) return { error: "Job not found." };

    await prisma.job.update({
      where: { id: jobId },
      data: { name, color, archived },
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
