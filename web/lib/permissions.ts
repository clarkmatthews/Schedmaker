import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  ADMINISTRATOR_SYSTEM_KEY,
  SETTINGS_PERMISSION_SECTIONS,
  allEditPermissions,
  levelMeets,
  parsePermissions,
  type AccessLevel,
  type MenuCapabilities,
  type PermissionSectionId,
  type RolePermissions,
} from "@/lib/roles";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export type CompanyAccess = {
  support: boolean;
  inDirectory: boolean;
  roleId: string | null;
  roleName: string | null;
  systemKey: string | null;
  permissions: RolePermissions;
};

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ActionError("You must be signed in.");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { confirmedAndActive: true },
  });
  if (!user?.confirmedAndActive) {
    throw new ActionError("You must be signed in.");
  }
  return session.user;
}

export async function assertTeamInCompany(companyId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) {
    throw new ActionError("Team not found.");
  }
  return team;
}

export async function getCompanyAccess(userId: string, companyId: string): Promise<CompanyAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { support: true },
  });
  const support = Boolean(user?.support);
  const directory = await prisma.directory.findUnique({
    where: { companyId_userId: { companyId, userId } },
    include: { role: true },
  });

  if (support) {
    return {
      support: true,
      inDirectory: Boolean(directory),
      roleId: directory?.roleId ?? null,
      roleName: directory?.role.name ?? "Support",
      systemKey: ADMINISTRATOR_SYSTEM_KEY,
      permissions: allEditPermissions(),
    };
  }

  return {
    support: false,
    inDirectory: Boolean(directory),
    roleId: directory?.roleId ?? null,
    roleName: directory?.role.name ?? null,
    systemKey: directory?.role.systemKey ?? null,
    permissions: parsePermissions(directory?.role.permissions, directory?.role.systemKey),
  };
}

export function can(
  access: Pick<CompanyAccess, "support" | "permissions">,
  section: PermissionSectionId,
  level: "view" | "edit",
) {
  if (access.support) return true;
  return levelMeets(access.permissions[section] ?? "none", level);
}

export function hasSettingsAccess(
  access: Pick<CompanyAccess, "support" | "permissions">,
  level: "view" | "edit" = "view",
) {
  return SETTINGS_PERMISSION_SECTIONS.some((section) => can(access, section, level));
}

export function canCreateCompanies(
  access: Pick<CompanyAccess, "support" | "permissions">,
) {
  return can(access, "createCompanies", "edit");
}

export function menuCapabilities(
  access: Pick<CompanyAccess, "support" | "permissions">,
): MenuCapabilities {
  return {
    employees: can(access, "employees", "view"),
    schedule: can(access, "schedule", "view"),
    settings: hasSettingsAccess(access, "view"),
    switchCompany: canCreateCompanies(access),
  };
}

export async function userCanCreateCompanies(userId: string, support: boolean) {
  if (support) return true;
  const companies = await getUserCompanies(userId, false);
  if (companies.length === 0) return true;
  for (const company of companies) {
    const access = await getCompanyAccess(userId, company.id);
    if (canCreateCompanies(access)) return true;
  }
  return false;
}

export function firstCompanyHref(
  companyId: string,
  access: Pick<CompanyAccess, "support" | "permissions">,
  teams: { id: string }[],
) {
  if (can(access, "employees", "view")) return `/app/companies/${companyId}/employees`;
  if (can(access, "schedule", "view") && teams[0]) {
    return `/app/companies/${companyId}/teams/${teams[0].id}/scheduling`;
  }
  if (hasSettingsAccess(access, "view")) return `/app/companies/${companyId}/settings`;
  return "/account";
}

export async function requireDirectory(companyId: string) {
  const user = await requireSession();
  const access = await getCompanyAccess(user.id, companyId);
  if (!access.support && !access.inDirectory) {
    throw new ActionError("You are not associated with this company.");
  }
  return { user, access };
}

export async function requirePermission(
  companyId: string,
  section: PermissionSectionId,
  level: Extract<AccessLevel, "view" | "edit">,
) {
  const { user, access } = await requireDirectory(companyId);
  if (!can(access, section, level)) {
    throw new ActionError("You do not have permission to do that.");
  }
  return { user, access };
}

export async function getUserCompanies(userId: string, support: boolean) {
  if (support) {
    return prisma.company.findMany({
      where: { archived: false },
      include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  const directoryRows = await prisma.directory.findMany({
    where: { userId },
    include: {
      company: {
        include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
      },
    },
  });

  return directoryRows
    .map((row) => row.company)
    .filter((company) => !company.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}
