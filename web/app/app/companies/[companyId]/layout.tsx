import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, canEnterCompany, getCompanyAccess, menuCapabilities } from "@/lib/permissions";
import { AppShell } from "@/components/app/app-shell";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;

  const [company, access, loan, otherLoans] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
    }),
    getCompanyAccess(session.user.id, companyId),
    prisma.employeeLoan.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId } },
    }),
    prisma.employeeLoan.findMany({
      where: {
        userId: session.user.id,
        active: true,
        companyId: { not: companyId },
        company: { archived: false, shiftSwapEnabled: true },
      },
      include: { company: { select: { id: true, name: true } } },
    }),
  ]);
  if (!company) notFound();

  const loanActive = Boolean(loan?.active);
  const loanOnly = !canEnterCompany(access) && company.shiftSwapEnabled && loanActive;
  if (!canEnterCompany(access) && !loanOnly) redirect("/app");

  const roleSeesSwap =
    company.shiftSwapEnabled &&
    (access.support || access.inDirectory || can(access, "shiftSwap", "view"));
  const capabilities = loanOnly
    ? {
        employees: false,
        schedule: false,
        settings: false,
        loans: false,
        switchCompany: false,
        shiftSwap: true,
        availability: false,
      }
    : menuCapabilities(access, {
        shiftSwap: company.shiftSwapEnabled,
        loanSwapOnly: company.shiftSwapEnabled && loanActive && !roleSeesSwap,
        availability: company.availabilityEnabled,
      });

  return (
    <AppShell
      companyId={company.id}
      companyName={company.name}
      capabilities={capabilities}
      teams={company.teams.map((team) => ({ id: team.id, name: team.name }))}
      loanSwaps={otherLoans.map((row) => ({ id: row.company.id, name: row.company.name }))}
      narrowMenu={loanOnly}
    >
      {children}
    </AppShell>
  );
}
