"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionError, requirePermission } from "@/lib/permissions";
import {
  ADMINISTRATOR_SYSTEM_KEY,
  allEditPermissions,
  isAccessLevel,
  nonePermissions,
  PERMISSION_SECTIONS,
} from "@/lib/roles";

function revalidateRoles(companyId: string) {
  revalidatePath(`/app/companies/${companyId}/settings`);
  revalidatePath(`/app/companies/${companyId}`, "layout");
}

function parseRolePermissions(formData: FormData, systemKey: string | null) {
  if (systemKey === ADMINISTRATOR_SYSTEM_KEY) return allEditPermissions();
  const parsed = nonePermissions();
  for (const section of PERMISSION_SECTIONS) {
    const value = String(formData.get(`perm_${section.id}`) ?? "none");
    if (isAccessLevel(value)) parsed[section.id] = value;
  }
  return parsed;
}

export async function createRoleAction(companyId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "roles", "edit");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Role name is required." };

    const duplicate = await prisma.role.findFirst({ where: { companyId, name } });
    if (duplicate) return { error: "A role with that name already exists." };

    const maxSort = await prisma.role.aggregate({
      where: { companyId },
      _max: { sortOrder: true },
    });
    await prisma.role.create({
      data: {
        companyId,
        name,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        permissions: parseRolePermissions(formData, null) as Prisma.InputJsonValue,
      },
    });
    revalidateRoles(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not create role." };
  }
}

export async function updateRoleAction(companyId: string, roleId: string, formData: FormData) {
  try {
    await requirePermission(companyId, "roles", "edit");
    const role = await prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) return { error: "Role not found." };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Role name is required." };

    const duplicate = await prisma.role.findFirst({
      where: { companyId, name, NOT: { id: roleId } },
    });
    if (duplicate) return { error: "A role with that name already exists." };

    const permissions =
      role.systemKey === ADMINISTRATOR_SYSTEM_KEY
        ? allEditPermissions()
        : parseRolePermissions(formData, role.systemKey);

    await prisma.role.update({
      where: { id: roleId },
      data: {
        name,
        permissions: permissions as Prisma.InputJsonValue,
      },
    });
    revalidateRoles(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update role." };
  }
}

export async function deleteRoleAction(companyId: string, roleId: string) {
  try {
    await requirePermission(companyId, "roles", "edit");
    const role = await prisma.role.findFirst({
      where: { id: roleId, companyId },
      include: { _count: { select: { members: true } } },
    });
    if (!role) return { error: "Role not found." };
    if (role.systemKey === ADMINISTRATOR_SYSTEM_KEY) {
      return { error: "The Administrator role cannot be deleted." };
    }
    if (role._count.members > 0) {
      return { error: "Reassign employees before deleting this role." };
    }
    await prisma.role.delete({ where: { id: roleId } });
    revalidateRoles(companyId);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not delete role." };
  }
}
