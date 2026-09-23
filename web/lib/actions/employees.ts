"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseBirthDate, parseHourlyRate } from "@/lib/employees";
import { emptyToNull } from "@/lib/utils";
import { issueEmailToken } from "@/lib/tokens";
import { notifyActivation, notifyOnboardWorker } from "@/lib/notifications";
import {
  ActionError,
  assertTeamInCompany,
  can,
  getCompanyAccess,
  requirePermission,
  requireSession,
} from "@/lib/permissions";
import { ADMINISTRATOR_SYSTEM_KEY, defaultEmployeeRoleId, ensureDefaultRoles } from "@/lib/roles";

function appUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

async function getOrCreateUser(params: {
  email: string;
  name: string;
  phoneNumber: string | null;
  companyId: string;
}) {
  const byEmail = await prisma.user.findUnique({ where: { email: params.email } });
  if (byEmail) return { user: byEmail, created: false as const };

  if (params.phoneNumber) {
    const byPhone = await prisma.user.findUnique({
      where: { phoneNumber: params.phoneNumber },
    });
    if (byPhone) {
      return { error: "That phone number is already used by another account." as const };
    }
  }

  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      phoneNumber: params.phoneNumber,
      profileOwnerCompanyId: params.companyId,
      homeCompanyId: params.companyId,
    },
  });
  return { user, created: true as const };
}

async function belongsToAnotherCompany(userId: string, companyId: string) {
  const other = await prisma.directory.findFirst({
    where: { userId, NOT: { companyId } },
    select: { companyId: true },
  });
  return Boolean(other);
}

async function assertEditableHere(companyId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { homeCompanyId: true },
  });
  if (!user) return { error: "Employee not found." as const };
  if (user.homeCompanyId && user.homeCompanyId !== companyId) {
    return { error: "Only the home store can edit this employee." as const };
  }
  return null;
}

function parseIdList(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
  } catch {
    return [];
  }
}

function parseJobAssignments(value: string) {
  const raw = value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const requested = new Map<string, boolean>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const jobId = String("jobId" in row ? row.jobId : "");
      if (!jobId) continue;
      const primary = "primary" in row && Boolean(row.primary);
      requested.set(jobId, primary || requested.get(jobId) === true);
    }
    return [...requested.entries()].map(([jobId, primary]) => ({ jobId, primary }));
  } catch {
    return [];
  }
}

export async function createEmployeeAction(companyId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "employees", "edit");
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
    const homeCompanyId = String(formData.get("homeCompanyId") ?? "").trim() || companyId;
    const jobAssignments = parseJobAssignments(String(formData.get("jobAssignments") ?? ""));
    const loanCompanyIds = parseIdList(String(formData.get("loanCompanyIds") ?? ""));
    const manageCompanyIds = parseIdList(String(formData.get("manageCompanyIds") ?? ""));
    const homeStaysHere = homeCompanyId === companyId;
    if (homeStaysHere && jobAssignments.length > 0 && jobAssignments.filter((job) => job.primary).length !== 1) {
      return { error: "Choose one primary job." };
    }
    if (!homeStaysHere) {
      const nextHome = await prisma.company.findFirst({
        where: { id: homeCompanyId, archived: false },
        select: { id: true },
      });
      if (!nextHome) return { error: "That company is not available." };
    }

    if (!email) return { error: "Email is required." };

    const resolved = await getOrCreateUser({ email, name, phoneNumber, companyId });
    if ("error" in resolved) return { error: resolved.error };
    const { user, created } = resolved;
    if (!created && user.homeCompanyId && user.homeCompanyId !== companyId) {
      const home = await prisma.company.findUnique({
        where: { id: user.homeCompanyId },
        select: { name: true },
      });
      return { homeCompanyName: home?.name || "their home store" };
    }
    if (!created && !user.homeCompanyId && !(await belongsToAnotherCompany(user.id, companyId))) {
      await prisma.user.update({
        where: { id: user.id },
        data: { homeCompanyId: companyId },
      });
    }
    if (birthDate && (created || !(await belongsToAnotherCompany(user.id, companyId)))) {
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

    const roleId = await defaultEmployeeRoleId(prisma, companyId);
    if (!roleId) return { error: "Create a role before adding employees." };

    await prisma.directory.create({
      data: {
        companyId,
        userId: user.id,
        internalId,
        mealBreakWaiver,
        hourlyRate: parsedRate.rate,
        roleId,
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

    if (homeStaysHere) {
      if (jobAssignments.length > 0) {
        const jobs = await setEmployeeJobsAction(companyId, user.id, jobAssignments);
        if (jobs.error) return { error: jobs.error, userId: user.id };
      }
      if (loanCompanyIds.length > 0) {
        const loans = await setEmployeeLoansAction(companyId, user.id, loanCompanyIds);
        if (loans.error) return { error: loans.error, userId: user.id };
      }
      if (manageCompanyIds.length > 0) {
        const manages = await setManagedCompaniesAction(companyId, user.id, manageCompanyIds);
        if (manages.error) return { error: manages.error, userId: user.id };
      }
    } else {
      const moved = await setHomeCompanyAction(companyId, user.id, homeCompanyId);
      if (moved.error) return { error: moved.error, userId: user.id };
      return { ok: true as const, userId: user.id, moved: true as const };
    }

    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const, userId: user.id, moved: false as const };
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
    await requirePermission(companyId, "employees", "edit");
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
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

    const ownsProfile = target.profileOwnerCompanyId === companyId;
    const userUpdate: {
      birthDate?: Date | null;
      name?: string;
      email?: string;
      phoneNumber?: string | null;
    } = {};
    if (formData.has("birthDate")) {
      const shared = !ownsProfile && (await belongsToAnotherCompany(userId, companyId));
      if (shared) {
        return {
          error: "Date of birth stays on their account because they belong to another company.",
        };
      }
      userUpdate.birthDate = birthDate;
    }
    if (formData.has("name") || formData.has("email") || formData.has("phoneNumber")) {
      if (target.confirmedAndActive || !ownsProfile) {
        return {
          error: "Name, email, and phone stay on their Schedmaker account.",
        };
      }
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
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      });
    }

    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update employee." };
  }
}

export async function setEmployeeRoleAction(
  companyId: string,
  userId: string,
  roleId: string,
) {
  try {
    const { user, access } = await requirePermission(companyId, "employees", "edit");
    if (!access.support && user.id === userId) {
      return { error: "You cannot change your own role." };
    }
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { role: true },
    });
    if (!directory) return { error: "Employee not found." };

    const nextRole = await prisma.role.findFirst({
      where: { id: roleId, companyId },
    });
    if (!nextRole) return { error: "Role not found." };

    if (
      nextRole.systemKey === ADMINISTRATOR_SYSTEM_KEY &&
      !can(access, "roles", "edit")
    ) {
      return { error: "Only role managers can assign Administrator." };
    }

    if (
      directory.role.systemKey === ADMINISTRATOR_SYSTEM_KEY &&
      nextRole.systemKey !== ADMINISTRATOR_SYSTEM_KEY
    ) {
      const remaining = await prisma.directory.count({
        where: {
          companyId,
          role: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
          NOT: { userId },
        },
      });
      if (remaining === 0) {
        return { error: "The company must keep at least one Administrator." };
      }
    }

    await prisma.directory.update({
      where: { companyId_userId: { companyId, userId } },
      data: { roleId },
    });
    revalidatePath(`/app/companies/${companyId}/employees`);
    revalidatePath(`/app/companies/${companyId}`, "layout");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update role." };
  }
}

export async function setEmployeeTeamAction(
  companyId: string,
  userId: string,
  teamId: string,
  assigned: boolean,
) {
  try {
    await requirePermission(companyId, "employees", "edit");
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
    const directory = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { userId: true },
    });
    if (!directory) return { error: "Employee not found." };
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
    await requirePermission(companyId, "employees", "edit");
    if (deactivated && current.id === userId) {
      return { error: "You cannot deactivate your own account." };
    }
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
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
    await requirePermission(companyId, "employees", "edit");
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
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

async function requireHomeEditor(companyId: string, userId: string) {
  await requirePermission(companyId, "employees", "edit");
  const blocked = await assertEditableHere(companyId, userId);
  if (blocked) return blocked;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { homeCompanyId: true },
  });
  if (!user) return { error: "Employee not found." as const };
  if (user.homeCompanyId !== companyId) {
    return { error: "Only the home store can change loans and management." as const };
  }
  return { user };
}

function revalidateCompanies(companyIds: string[]) {
  for (const id of new Set(companyIds)) {
    revalidatePath(`/app/companies/${id}/employees`);
    revalidatePath(`/app/companies/${id}/loans`);
    revalidatePath(`/app/companies/${id}`, "layout");
  }
}

async function applyEmployeeLoans(homeCompanyId: string, userId: string, companyIds: string[]) {
  const requested = [...new Set(companyIds.filter((id) => id && id !== homeCompanyId))];
  const available = requested.length
    ? await prisma.company.findMany({
        where: { id: { in: requested }, archived: false },
        select: { id: true },
      })
    : [];
  const desired = new Set(available.map((company) => company.id));
  const memberships = desired.size
    ? await prisma.directory.findMany({
        where: { userId, companyId: { in: [...desired] } },
        select: { companyId: true },
      })
    : [];
  for (const membership of memberships) desired.delete(membership.companyId);

  const existing = await prisma.employeeLoan.findMany({
    where: { userId },
    select: { companyId: true, active: true },
  });
  const affected = new Set<string>([homeCompanyId]);
  for (const destinationId of desired) {
    await prisma.employeeLoan.upsert({
      where: { userId_companyId: { userId, companyId: destinationId } },
      update: { active: true },
      create: { userId, companyId: destinationId, active: true },
    });
    affected.add(destinationId);
  }
  for (const loan of existing) {
    if (loan.active && !desired.has(loan.companyId)) {
      await prisma.employeeLoan.update({
        where: { userId_companyId: { userId, companyId: loan.companyId } },
        data: { active: false },
      });
      affected.add(loan.companyId);
    }
  }
  revalidateCompanies([...affected]);
}

export async function setHomeCompanyAction(
  companyId: string,
  userId: string,
  nextHomeId: string,
) {
  try {
    await requirePermission(companyId, "employees", "edit");
    const blocked = await assertEditableHere(companyId, userId);
    if (blocked) return blocked;
    const nextHome = await prisma.company.findFirst({
      where: { id: nextHomeId, archived: false },
      select: { id: true },
    });
    if (!nextHome) return { error: "That company is not available." };
    const source = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { role: true },
    });
    if (!source) return { error: "Employee not found." };
    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: { homeCompanyId: true },
    });
    if (!account?.homeCompanyId && nextHomeId !== companyId) {
      const belongs = await prisma.directory.findUnique({
        where: { companyId_userId: { companyId: nextHomeId, userId } },
        select: { userId: true },
      });
      if (!belongs) return { error: "Choose a company this person already belongs to." };
    }

    if (nextHomeId === companyId) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { homeCompanyId: companyId },
        }),
        prisma.employeeLoan.updateMany({
          where: { userId, companyId },
          data: { active: false },
        }),
        prisma.companyManager.deleteMany({ where: { userId, companyId } }),
      ]);
      revalidateCompanies([companyId]);
      return { ok: true as const, moved: false as const };
    }

    await prisma.$transaction(async (tx) => {
      const roles = await ensureDefaultRoles(tx, nextHomeId);
      const roleId =
        roles.find((role) => source.role.systemKey && role.systemKey === source.role.systemKey)?.id ??
        roles.find((role) => role.name === source.role.name)?.id ??
        roles.find((role) => role.name === "Employee")?.id ??
        roles[0]?.id;
      if (!roleId) throw new Error("Create a role before moving this employee.");
      const record = {
        roleId,
        internalId: source.internalId,
        deactivated: source.deactivated,
        mealBreakWaiver: source.mealBreakWaiver,
        hourlyRate: source.hourlyRate,
      };
      await tx.directory.upsert({
        where: { companyId_userId: { companyId: nextHomeId, userId } },
        create: { companyId: nextHomeId, userId, ...record },
        update: record,
      });
      const oldTeams = await tx.team.findMany({
        where: { companyId },
        select: { id: true },
      });
      if (oldTeams.length) {
        await tx.worker.deleteMany({
          where: { userId, teamId: { in: oldTeams.map((team) => team.id) } },
        });
      }
      await tx.directory.delete({
        where: { companyId_userId: { companyId, userId } },
      });
      await tx.employeeLoan.updateMany({
        where: { userId, companyId: nextHomeId },
        data: { active: false },
      });
      await tx.companyManager.deleteMany({ where: { userId, companyId: nextHomeId } });
      await tx.user.update({
        where: { id: userId },
        data: { homeCompanyId: nextHomeId },
      });
    });
    revalidateCompanies([companyId, nextHomeId]);
    return { ok: true as const, moved: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    if (error instanceof Error && error.message.startsWith("Create a role")) {
      return { error: error.message };
    }
    return { error: "Could not change the home store." };
  }
}

export async function setEmployeeLoansAction(
  companyId: string,
  userId: string,
  companyIds: string[],
) {
  try {
    const allowed = await requireHomeEditor(companyId, userId);
    if ("error" in allowed) return allowed;
    await applyEmployeeLoans(companyId, userId, companyIds);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update loans." };
  }
}

export async function setEmployeeLoansFromBoardAction(userId: string, companyIds: string[]) {
  try {
    const session = await requireSession();
    const person = await prisma.user.findUnique({
      where: { id: userId },
      select: { homeCompanyId: true },
    });
    if (!person?.homeCompanyId) {
      return { error: "Only the home store can change loans." };
    }
    const access = await getCompanyAccess(session.id, person.homeCompanyId);
    if (!can(access, "company", "edit")) {
      return { error: "Only the home store can change loans." };
    }
    await applyEmployeeLoans(person.homeCompanyId, userId, companyIds);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update loans." };
  }
}

export async function setManagedCompaniesAction(
  companyId: string,
  userId: string,
  companyIds: string[],
) {
  try {
    const allowed = await requireHomeEditor(companyId, userId);
    if ("error" in allowed) return allowed;
    const requested = [...new Set(companyIds.filter((id) => id && id !== companyId))];
    const available = requested.length
      ? await prisma.company.findMany({
          where: { id: { in: requested }, archived: false },
          select: { id: true },
        })
      : [];
    const desired = new Set(available.map((company) => company.id));
    const existing = await prisma.companyManager.findMany({
      where: { userId },
      select: { companyId: true },
    });
    const affected = new Set<string>([companyId, ...desired, ...existing.map((row) => row.companyId)]);
    await prisma.$transaction(async (tx) => {
      const remove = existing.filter((row) => !desired.has(row.companyId)).map((row) => row.companyId);
      if (remove.length) {
        await tx.companyManager.deleteMany({
          where: { userId, companyId: { in: remove } },
        });
      }
      for (const destinationId of desired) {
        await tx.companyManager.upsert({
          where: { userId_companyId: { userId, companyId: destinationId } },
          update: {},
          create: { userId, companyId: destinationId },
        });
      }
    });
    revalidateCompanies([...affected]);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update managed stores." };
  }
}

export async function setEmployeeJobsAction(
  companyId: string,
  userId: string,
  assignments: { jobId: string; primary: boolean }[],
) {
  try {
    const allowed = await requireHomeEditor(companyId, userId);
    if ("error" in allowed) return allowed;
    const requested = new Map<string, boolean>();
    for (const assignment of assignments) {
      if (!assignment.jobId) continue;
      requested.set(assignment.jobId, Boolean(assignment.primary) || requested.get(assignment.jobId) === true);
    }
    const available = requested.size
      ? await prisma.job.findMany({
          where: {
            id: { in: [...requested.keys()] },
            archived: false,
            team: { companyId, archived: false },
          },
          select: { id: true },
        })
      : [];
    const desired = available.map((job) => ({
      jobId: job.id,
      primary: requested.get(job.id) === true,
    }));
    const primaryCount = desired.filter((job) => job.primary).length;
    if (desired.length > 0 && primaryCount !== 1) {
      return { error: "Choose one primary job." };
    }
    const existing = await prisma.employeeJob.findMany({
      where: { userId, job: { team: { companyId } } },
      select: { jobId: true },
    });
    await prisma.$transaction(async (tx) => {
      const keep = new Set(desired.map((job) => job.jobId));
      const remove = existing.filter((row) => !keep.has(row.jobId)).map((row) => row.jobId);
      if (remove.length) {
        await tx.employeeJob.deleteMany({
          where: { userId, jobId: { in: remove } },
        });
      }
      if (desired.some((job) => job.primary)) {
        await tx.employeeJob.updateMany({
          where: { userId, primary: true },
          data: { primary: false },
        });
      }
      for (const job of desired) {
        await tx.employeeJob.upsert({
          where: { userId_jobId: { userId, jobId: job.jobId } },
          update: { primary: job.primary },
          create: { userId, jobId: job.jobId, primary: job.primary },
        });
      }
    });
    revalidateCompanies([companyId]);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update jobs." };
  }
}
