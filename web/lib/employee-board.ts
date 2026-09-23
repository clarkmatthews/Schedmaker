import { prisma } from "@/lib/db";
import { displayPhone } from "@/lib/phone";
import {
  hourlyRateNumber,
  mapDirectoryEmployee,
  type EmployeeRecord,
  type EmployeeRoleOption,
} from "@/lib/employees";

export async function loadEmployeeBoard(companyId: string) {
  const [directory, roles, teams, companies, outgoingLoans, incomingLoans, managerRows, jobRows, assignmentRows] =
    await Promise.all([
    prisma.directory.findMany({
      where: { companyId },
      include: {
        user: { include: { workerOf: true, directoryEntries: { select: { companyId: true } } } },
        role: true,
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.role.findMany({ where: { companyId }, orderBy: { sortOrder: "asc" } }),
    prisma.team.findMany({
      where: { companyId, archived: false },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employeeLoan.findMany({
      where: { active: true, user: { directoryEntries: { some: { companyId } } } },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.employeeLoan.findMany({
      where: { companyId, active: true },
      include: {
        user: {
          include: {
            directoryEntries: {
              select: {
                companyId: true,
                internalId: true,
                deactivated: true,
                mealBreakWaiver: true,
                hourlyRate: true,
              },
            },
          },
        },
      },
    }),
    prisma.companyManager.findMany({
      where: { user: { directoryEntries: { some: { companyId } } } },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.job.findMany({
      where: { archived: false, team: { companyId, archived: false } },
      select: { id: true, name: true, hourlyRate: true, team: { select: { name: true } } },
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.employeeJob.findMany({
      where: {
        user: {
          OR: [
            { directoryEntries: { some: { companyId } } },
            { loans: { some: { companyId, active: true } } },
          ],
        },
      },
      select: {
        userId: true,
        primary: true,
        job: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
            team: { select: { name: true, companyId: true } },
          },
        },
      },
    }),
  ]);

  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const teamIds = teams.map((team) => team.id);
  const loansByUser = new Map<string, { companyId: string; companyName: string }[]>();
  for (const loan of outgoingLoans) {
    const list = loansByUser.get(loan.userId) ?? [];
    list.push({ companyId: loan.companyId, companyName: loan.company.name });
    loansByUser.set(loan.userId, list);
  }
  const managesByUser = new Map<string, { companyId: string; companyName: string }[]>();
  for (const manager of managerRows) {
    const list = managesByUser.get(manager.userId) ?? [];
    list.push({ companyId: manager.companyId, companyName: manager.company.name });
    managesByUser.set(manager.userId, list);
  }
  const sortCompanies = (rows: { companyId: string; companyName: string }[]) =>
    [...rows].sort((a, b) => a.companyName.localeCompare(b.companyName));
  const jobsByUser = new Map<string, EmployeeRecord["jobs"]>();
  for (const row of assignmentRows) {
    const list = jobsByUser.get(row.userId) ?? [];
    list.push({
      jobId: row.job.id,
      jobName: row.job.name,
      teamName: row.job.team.name,
      primary: row.primary,
      hourlyRate: hourlyRateNumber(row.job.hourlyRate),
    });
    jobsByUser.set(row.userId, list);
  }
  for (const [userId, list] of jobsByUser) {
    list.sort((a, b) => Number(b.primary) - Number(a.primary) || a.jobName.localeCompare(b.jobName));
    jobsByUser.set(userId, list);
  }

  const employees: EmployeeRecord[] = directory.map((entry) =>
    mapDirectoryEmployee(
      entry,
      teamIds,
      companyId,
      entry.user.homeCompanyId ? (companyName.get(entry.user.homeCompanyId) ?? null) : null,
      sortCompanies(loansByUser.get(entry.userId) ?? []),
      sortCompanies(managesByUser.get(entry.userId) ?? []),
      jobsByUser.get(entry.userId) ?? [],
    ),
  );

  const memberIds = new Set(employees.map((employee) => employee.userId));
  for (const loan of incomingLoans) {
    if (memberIds.has(loan.userId)) continue;
    const homeId = loan.user.homeCompanyId;
    const homeEntry = loan.user.directoryEntries.find((entry) => entry.companyId === homeId);
    employees.push({
      userId: loan.userId,
      name: loan.user.name,
      email: loan.user.email,
      phoneNumber: displayPhone(loan.user.phoneNumber) || null,
      internalId: homeEntry?.internalId ?? "",
      confirmedAndActive: loan.user.confirmedAndActive,
      deactivated: Boolean(homeEntry?.deactivated),
      mealBreakWaiver: Boolean(homeEntry?.mealBreakWaiver),
      birthDate: loan.user.birthDate ? loan.user.birthDate.toISOString().slice(0, 10) : null,
      hourlyRate: hourlyRateNumber(homeEntry?.hourlyRate),
      roleId: "",
      roleName: "Loaned",
      teamIds: [],
      canEditIdentity: false,
      canEditBirthDate: false,
      homeCompanyId: homeId,
      homeCompanyName: homeId ? (companyName.get(homeId) ?? null) : null,
      memberCompanyIds: loan.user.directoryEntries.map((entry) => entry.companyId),
      loaned: true,
      loans: [],
      manages: [],
      jobs: jobsByUser.get(loan.userId) ?? [],
    });
  }

  employees.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

  const roleOptions: EmployeeRoleOption[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
    systemKey: role.systemKey,
  }));

  return {
    employees,
    roles: roleOptions,
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    companies,
    jobs: jobRows.map((job) => ({
      id: job.id,
      name: job.name,
      teamName: job.team.name,
      hourlyRate: hourlyRateNumber(job.hourlyRate),
    })),
  };
}
