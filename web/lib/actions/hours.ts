"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ActionError, requireCompanyAdmin } from "@/lib/permissions";
import { WEEKDAYS } from "@/lib/utils";
import { END_SLOT } from "@/lib/scheduling/time-grid";
import { defaultHoursDays } from "@/lib/scheduling/hours";

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const START_SLOT_MAX = END_SLOT - 1;

function revalidateHours(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/settings`);
  revalidatePath(`/app/companies/${companyId}`, "layout");
}

function parseDays(formData: FormData) {
  const raw = String(formData.get("days") ?? "");
  if (!raw) return defaultHoursDays();
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return defaultHoursDays();
  return WEEKDAYS.map((weekday) => {
    const row = parsed.find((item) => (item as { weekday?: string }).weekday === weekday) as
      | {
          closed?: boolean;
          scheduleStartSlot?: number;
          scheduleEndSlot?: number;
          businessStartSlot?: number | null | "";
          businessEndSlot?: number | null | "";
        }
      | undefined;
    const scheduleStartSlot = clampInt(row?.scheduleStartSlot, 32, 0, START_SLOT_MAX);
    const scheduleEndSlot = clampInt(row?.scheduleEndSlot, END_SLOT, scheduleStartSlot + 1, END_SLOT);
    const hasBusiness =
      row?.businessStartSlot != null &&
      row?.businessEndSlot != null &&
      row.businessStartSlot !== "" &&
      row.businessEndSlot !== "";
    return {
      weekday,
      closed: Boolean(row?.closed),
      scheduleStartSlot,
      scheduleEndSlot,
      businessStartSlot: hasBusiness
        ? clampInt(row?.businessStartSlot, scheduleStartSlot, scheduleStartSlot, scheduleEndSlot - 1)
        : null,
      businessEndSlot: hasBusiness
        ? clampInt(row?.businessEndSlot, scheduleEndSlot, scheduleStartSlot + 1, scheduleEndSlot)
        : null,
    };
  });
}

export async function createHoursTemplateAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const name = String(formData.get("name") ?? "").trim() || "Standard hours";
    const days = parseDays(formData);
    const created = await prisma.$transaction(async (tx) => {
      const template = await tx.hoursTemplate.create({
        data: {
          companyId,
          name,
          days: { create: days },
        },
      });
      const company = await tx.company.findUnique({ where: { id: companyId } });
      if (company && !company.hoursTemplateId) {
        await tx.company.update({
          where: { id: companyId },
          data: { hoursTemplateId: template.id },
        });
      }
      return template;
    });
    revalidateHours(companyId);
    return { ok: true as const, templateId: created.id };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not create hours template." };
  }
}

export async function updateHoursTemplateAction(
  companyId: string,
  templateId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const existing = await prisma.hoursTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!existing) return { error: "Template not found." };
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Name is required." };
    const days = parseDays(formData);
    await prisma.$transaction(async (tx) => {
      await tx.hoursTemplate.update({
        where: { id: templateId },
        data: { name },
      });
      await tx.hoursTemplateDay.deleteMany({ where: { templateId } });
      await tx.hoursTemplateDay.createMany({
        data: days.map((day) => ({ templateId, ...day })),
      });
    });
    revalidateHours(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update hours template." };
  }
}

export async function assignHoursTemplateAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const templateId = String(formData.get("hoursTemplateId") ?? "").trim() || null;
    if (templateId) {
      const template = await prisma.hoursTemplate.findFirst({
        where: { id: templateId, companyId },
      });
      if (!template) return { error: "Template not found." };
    }
    await prisma.company.update({
      where: { id: companyId },
      data: { hoursTemplateId: templateId },
    });
    revalidateHours(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not assign hours template." };
  }
}

export async function deleteHoursTemplateAction(companyId: string, templateId: string) {
  try {
    await requireCompanyAdmin(companyId);
    const existing = await prisma.hoursTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!existing) return { error: "Template not found." };
    await prisma.$transaction(async (tx) => {
      await tx.company.updateMany({
        where: { id: companyId, hoursTemplateId: templateId },
        data: { hoursTemplateId: null },
      });
      await tx.hoursTemplate.delete({ where: { id: templateId } });
    });
    revalidateHours(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not delete hours template." };
  }
}
