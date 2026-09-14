"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseBirthDate, parseHourlyRate } from "@/lib/employees";
import { emptyToNull } from "@/lib/utils";
import { issueEmailToken } from "@/lib/tokens";
import { notifyActivation, notifyOnboardWorker } from "@/lib/notifications";
import { ActionError, assertTeamInCompany, requireCompanyAdmin, requireSession } from "@/lib/permissions";

function appUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

async function getOrCreateUser(params: {
  email: string;
  name: string;
  phoneNumber: string | null;
}) {
  const byEmail = await prisma.user.findUnique({ where: { email: params.email } });
  if (byEmail) return { user: byEmail, created: false };

  if (params.phoneNumber) {
    const byPhone = await prisma.user.findUnique({
      where: { phoneNumber: params.phoneNumber },
    });
    if (byPhone) return { user: byPhone, created: false };
  }

  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      phoneNumber: params.phoneNumber,
    },
  });
  return { user, created: true };
}

export async function createEmployeeAction(companyId: string, formData: FormData) {
  try {
    await requireCompanyAdmin(companyId);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const phoneNumber = emptyToNull(String(formData.get("phoneNumber") ?? ""));
    const internalId = String(formData.get("internalId") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim();
    const birthDateRaw = String(formData.get("birthDate") ?? "").trim();
    const birthDate = birthDateRaw ? parseBirthDate(birthDateRaw) : null;
    if (birthDateRaw && !birthDate) return { error: "Enter a valid date of birth." };
    const mealBreakWaiver = String(formData.get("mealBreakWaiver") ?? "") === "on";
    const parsedRate = parseHourlyRate(String(formData.get("hourlyRate") ?? ""));
    if (parsedRate.error) return { error: parsedRate.error };

    if (!email) return { error: "Email is required." };

    const { user, created } = await getOrCreateUser({ email, name, phoneNumber });
    if (birthDate) {
      await prisma.user.update({
        where: { id: user.id },
        data: { birthDate },
      });
    }

    const exists = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (exists) {
      return { error: "That person is already in this company." };
    }

    await prisma.directory.create({
      data: {
        companyId,
        userId: user.id,
        internalId,
        mealBreakWaiver,
        hourlyRate: parsedRate.rate,
      },
    });

    if (teamId) {
      await assertTeamInCompany(companyId, teamId);
      await prisma.worker.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        update: {},
        create: { teamId, userId: user.id },
      });
    }

    if (created) {
      const token = await issueEmailToken({
        userId: user.id,
        email: user.email,
        type: "activate",
      });
      await notifyActivation(user.email, user.name, `${appUrl()}/activate/${token}`);
    }
    await notifyOnboardWorker(companyId, user.id);

    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const, userId: user.id };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not add employee." };
  }
}

export async function updateEmployeeAction(
  companyId: string,
  userId: string,
  formData: FormData,
) {
  try {
    await requireCompanyAdmin(companyId);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!target || !directory) return { error: "Employee not found." };

    const internalId = String(formData.get("internalId") ?? "").trim();
    const birthDateRaw = String(formData.get("birthDate") ?? "").trim();
    const birthDate = birthDateRaw ? parseBirthDate(birthDateRaw) : null;
    if (birthDateRaw && !birthDate) return { error: "Enter a valid date of birth." };
    const parsedRate = parseHourlyRate(String(formData.get("hourlyRate") ?? ""));
    if (parsedRate.error) return { error: parsedRate.error };

    await prisma.directory.update({
      where: { companyId_userId: { companyId, userId } },
      data: { internalId, hourlyRate: parsedRate.rate },
    });

    const userUpdate: { birthDate: Date | null; name?: string; email?: string; phoneNumber?: string | null } = {
      birthDate,
    };
    if (!target.confirmedAndActive) {
      const name = String(formData.get("name") ?? "").trim();
      const email = String(formData.get("email") ?? "")
        .trim()
        .toLowerCase();
      const phoneNumber = emptyToNull(String(formData.get("phoneNumber") ?? ""));
      if (!email) return { error: "Email is required." };
      userUpdate.name = name;
      userUpdate.email = email;
      userUpdate.phoneNumber = phoneNumber;
    }
    await prisma.user.update({
      where: { id: userId },
      data: userUpdate,
    });

    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update employee." };
  }
}

export async function setEmployeeAdminAction(
  companyId: string,
  userId: string,
  makeAdmin: boolean,
) {
  try {
    await requireCompanyAdmin(companyId);
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!directory) return { error: "Employee not found." };

    if (makeAdmin) {
      await prisma.admin.upsert({
        where: { companyId_userId: { companyId, userId } },
        update: {},
        create: { companyId, userId },
      });
    } else {
      await prisma.admin.deleteMany({ where: { companyId, userId } });
    }
    revalidatePath(`/app/companies/${companyId}/employees`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update admin status." };
  }
}

export async function setEmployeeTeamAction(
  companyId: string,
  userId: string,
  teamId: string,
  assigned: boolean,
) {
  try {
    await requireCompanyAdmin(companyId);
    await assertTeamInCompany(companyId, teamId);

    if (assigned) {
      await prisma.worker.upsert({
        where: { teamId_userId: { teamId, userId } },
        update: {},
        create: { teamId, userId },
      });
    } else {
      await prisma.worker.deleteMany({ where: { teamId, userId } });
    }
    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}/teams/${teamId}/scheduling`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update team membership." };
  }
}

export async function setEmployeeDeactivatedAction(
  companyId: string,
  userId: string,
  deactivated: boolean,
) {
  try {
    const current = await requireSession();
    await requireCompanyAdmin(companyId);
    if (deactivated && current.id === userId) {
      return { error: "You cannot deactivate your own account." };
    }
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!directory) return { error: "Employee not found." };

    await prisma.directory.update({
      where: { companyId_userId: { companyId, userId } },
      data: { deactivated },
    });
    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update employee status." };
  }
}

export async function setEmployeeMealWaiverAction(
  companyId: string,
  userId: string,
  mealBreakWaiver: boolean,
) {
  try {
    await requireCompanyAdmin(companyId);
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!directory) return { error: "Employee not found." };

    await prisma.directory.update({
      where: { companyId_userId: { companyId, userId } },
      data: { mealBreakWaiver },
    });
    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update meal-break waiver." };
  }
}
