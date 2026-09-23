import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmployeeManager } from "@/components/employees/employee-manager";
import { loadEmployeeBoard } from "@/lib/employee-board";
import { can, getCompanyAccess } from "@/lib/permissions";
import { ADMINISTRATOR_SYSTEM_KEY } from "@/lib/roles";

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!can(access, "employees", "view")) redirect("/account");
  const { deactivated } = await searchParams;
  const board = await loadEmployeeBoard(companyId);

  return (
    <EmployeeManager
      companyId={companyId}
      currentUserId={session.user.id}
      canEdit={can(access, "employees", "edit")}
      canAssignAdministrator={can(access, "roles", "edit")}
      canResetPasswords={
        access.support || access.systemKey === ADMINISTRATOR_SYSTEM_KEY
      }
      roles={board.roles}
      teams={board.teams}
      companies={board.companies}
      jobs={board.jobs}
      showDeactivated={deactivated === "1"}
      employees={board.employees}
    />
  );
}
