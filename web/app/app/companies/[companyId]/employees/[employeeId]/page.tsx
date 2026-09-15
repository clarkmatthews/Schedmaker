import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EmployeeManager } from "@/components/employees/employee-manager";
import { mapDirectoryEmployee } from "@/lib/employees";
import { can, getCompanyAccess } from "@/lib/permissions";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; employeeId: string }>;
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId, employeeId } = await params;
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!can(access, "employees", "view")) redirect("/account");
  const { deactivated } = await searchParams;
  const [directory, roles, teams] = await Promise.all([
    prisma.directory.findMany({
      where: { companyId },
      include: { user: { include: { workerOf: true } }, role: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.role.findMany({ where: { companyId }, orderBy: { sortOrder: "asc" } }),
    prisma.team.findMany({
      where: { companyId, archived: false },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <EmployeeManager
      companyId={companyId}
      selectedId={employeeId}
      currentUserId={session.user.id}
      canEdit={can(access, "employees", "edit")}
      canAssignAdministrator={can(access, "roles", "edit")}
      roles={roles.map((role) => ({
        id: role.id,
        name: role.name,
        systemKey: role.systemKey,
      }))}
      showDeactivated={deactivated === "1"}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      employees={directory.map((entry) =>
        mapDirectoryEmployee(
          entry,
          teams.map((team) => team.id),
        ),
      )}
    />
  );
}
