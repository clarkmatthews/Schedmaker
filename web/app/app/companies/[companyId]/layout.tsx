import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCompanyAccess } from "@/lib/permissions";
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { teams: { where: { archived: false }, orderBy: { name: "asc" } } },
  });
  if (!company) notFound();

  const access = await getCompanyAccess(session.user.id, companyId);
  if (!access.support && !access.inDirectory) {
    redirect("/app");
  }

  return (
    <AppShell
      companyId={company.id}
      companyName={company.name}
      isAdmin={access.admin || access.support}
      teams={company.teams.map((team) => ({ id: team.id, name: team.name }))}
    >
      {children}
    </AppShell>
  );
}
