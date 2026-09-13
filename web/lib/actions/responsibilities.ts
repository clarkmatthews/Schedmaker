"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, requireCompanyAdmin } from "@/lib/permissions";

function revalidateSettings(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/settings`);
}

export async function createResponsibilityAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim() || null;
    if (!name) return { error: "Name is required." };

    if (teamId) {
      const team = await prisma.team.findFirst({ where: { id: teamId, companyId } });
      if (!team) return { error: "Invalid team." };
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
    await requireCompanyAdmin(companyId);
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
