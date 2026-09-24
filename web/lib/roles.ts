import type { Prisma, PrismaClient } from "@prisma/client";

export const PERMISSION_SECTIONS = [
  { id: "employees", label: "Employees", group: "nav" },
  { id: "schedule", label: "Scheduling", group: "nav" },
  { id: "availability", label: "Availability", group: "nav" },
  { id: "createCompanies", label: "Create companies", group: "nav" },
  { id: "company", label: "Company", group: "settings" },
  { id: "hours", label: "Hours", group: "settings" },
  { id: "scheduling", label: "Scheduling rules", group: "settings" },
  { id: "mms", label: "MMS", group: "settings" },
  { id: "teams", label: "Teams", group: "settings" },
  { id: "responsibilities", label: "Responsibilities", group: "settings" },
  { id: "roles", label: "Roles", group: "settings" },
] as const;

export type PermissionSectionId = (typeof PERMISSION_SECTIONS)[number]["id"];
export type AccessLevel = "none" | "view" | "edit";
export type RolePermissions = Record<PermissionSectionId, AccessLevel>;

export type MenuCapabilities = {
  employees: boolean;
  schedule: boolean;
  settings: boolean;
  loans: boolean;
  switchCompany: boolean;
};

export const ADMINISTRATOR_SYSTEM_KEY = "administrator";

export const SETTINGS_PERMISSION_SECTIONS: PermissionSectionId[] = PERMISSION_SECTIONS.filter(
  (section) => section.group === "settings",
).map((section) => section.id);

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

type RoleDb = PrismaClient | Prisma.TransactionClient;

export function nonePermissions(): RolePermissions {
  return Object.fromEntries(PERMISSION_SECTIONS.map((section) => [section.id, "none"])) as RolePermissions;
}

export function allEditPermissions(): RolePermissions {
  return Object.fromEntries(PERMISSION_SECTIONS.map((section) => [section.id, "edit"])) as RolePermissions;
}

export function employeePermissions(): RolePermissions {
  return { ...nonePermissions(), schedule: "view" };
}

export function managerPermissions(): RolePermissions {
  return { ...nonePermissions(), employees: "edit", schedule: "edit", availability: "edit" };
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return value === "none" || value === "view" || value === "edit";
}

export function parsePermissions(raw: unknown, systemKey?: string | null): RolePermissions {
  if (systemKey === ADMINISTRATOR_SYSTEM_KEY) return allEditPermissions();
  const parsed = nonePermissions();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return parsed;
  const record = raw as Record<string, unknown>;
  for (const section of PERMISSION_SECTIONS) {
    const level = record[section.id];
    if (isAccessLevel(level)) parsed[section.id] = level;
  }
  return parsed;
}

export function levelMeets(current: AccessLevel, needed: "view" | "edit") {
  return LEVEL_RANK[current] >= LEVEL_RANK[needed];
}

export function defaultRoleRows(companyId: string) {
  return [
    {
      companyId,
      name: "Employee",
      systemKey: null as string | null,
      sortOrder: 0,
      permissions: employeePermissions() as Prisma.InputJsonValue,
    },
    {
      companyId,
      name: "Restaurant manager",
      systemKey: null as string | null,
      sortOrder: 1,
      permissions: managerPermissions() as Prisma.InputJsonValue,
    },
    {
      companyId,
      name: "Administrator",
      systemKey: ADMINISTRATOR_SYSTEM_KEY,
      sortOrder: 2,
      permissions: allEditPermissions() as Prisma.InputJsonValue,
    },
  ];
}

export async function createDefaultRoles(db: RoleDb, companyId: string) {
  const created: { id: string; name: string; systemKey: string | null }[] = [];
  for (const row of defaultRoleRows(companyId)) {
    created.push(await db.role.create({ data: row }));
  }
  return created;
}

export async function ensureDefaultRoles(db: RoleDb, companyId: string) {
  const existing = await db.role.findMany({ where: { companyId } });
  if (existing.length === 0) return createDefaultRoles(db, companyId);
  return existing;
}

export async function defaultEmployeeRoleId(db: RoleDb, companyId: string) {
  const roles = await db.role.findMany({
    where: { companyId },
    orderBy: { sortOrder: "asc" },
  });
  const employee = roles.find((role) => role.name === "Employee");
  if (employee) return employee.id;
  const nonAdmin = roles.find((role) => role.systemKey !== ADMINISTRATOR_SYSTEM_KEY);
  return nonAdmin?.id ?? roles[0]?.id ?? null;
}
