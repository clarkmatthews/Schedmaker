import { prisma } from "@/lib/db";
import { EmployeeManager } from "@/components/employees/employee-manager";
import { mapDirectoryEmployee } from "@/lib/employees";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; employeeId: string }>;
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const { companyId, employeeId } = await params;
  const { deactivated } = await searchParams;
  const [directory, admins, teams] = await Promise.all([
    prisma.directory.findMany({
      where: { companyId },
      include: { user: { include: { workerOf: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.admin.findMany({ where: { companyId } }),
    prisma.team.findMany({
      where: { companyId, archived: false },
      orderBy: { name: "asc" },
    }),
  ]);
  const adminIds = new Set(admins.map((row) => row.userId));

  return (
    <EmployeeManager
      companyId={companyId}
      selectedId={employeeId}
      showDeactivated={deactivated === "1"}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      employees={directory.map((entry) =>
        mapDirectoryEmployee(
          entry,
          adminIds,
          teams.map((team) => team.id),
        ),
      )}
    />
  );
}
