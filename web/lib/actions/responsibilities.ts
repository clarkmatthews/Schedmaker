"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, assertTeamInCompany, requirePermission } from "@/lib/permissions";

function revalidateSettings(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/settings`);
  revalidatePath(`/app/companies/${companyId}`, "layout");
}

export async function setResponsibilitiesEnabledAction(
  companyId: string,
  enabled: boolean,
) {
  try {
    await requirePermission(companyId, "responsibilities", "edit");
    await prisma.company.update({
      where: { id: companyId },
      data: { responsibilitiesEnabled: enabled },
    });
    revalidateSettings(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update responsibilities setting." };
  }
}

export async function createResponsibilityAction(companyId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "responsibilities", "edit");
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim() || null;
    if (!name) return { error: "Name is required." };

    if (teamId) {
      await assertTeamInCompany(companyId, teamId);
    }

    await prisma.responsibility.create({
      data: { companyId, teamId, name, description },
    });
    revalidateSettings(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not create responsibility." };
  }
}

export async function updateResponsibilityAction(
  companyId: string,
  responsibilityId: string,
  formData: FormData,
) {
  try {
    await requirePermission(companyId, "responsibilities", "edit");
    const existing = await prisma.responsibility.findFirst({
      where: { id: responsibilityId, companyId },
    });
    if (!existing) return { error: "Responsibility not found." };

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const archived = String(formData.get("archived") ?? "") === "true";
    if (!name) return { error: "Name is required." };

    await prisma.responsibility.update({
      where: { id: responsibilityId },
      data: { name, description, archived },
    });
    revalidateSettings(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update responsibility." };
  }
}
