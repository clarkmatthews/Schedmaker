import { prisma } from "@/lib/db";
import { EmployeeManager } from "@/components/employees/employee-manager";
import { mapDirectoryEmployee } from "@/lib/employees";

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const { companyId } = await params;
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
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      showDeactivated={deactivated === "1"}
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
