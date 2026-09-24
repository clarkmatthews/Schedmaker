import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { availabilityAudience } from "@/lib/availability-access";
import { getCompanyAccess, getUserCompanies, menuCapabilities } from "@/lib/permissions";
import { toUnavailableEntry } from "@/lib/scheduling/availability";
import { AppShell } from "@/components/app/app-shell";
import { AvailabilityEditor } from "@/components/availability/availability-editor";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [audience, companies] = await Promise.all([
    availabilityAudience(session.user.id),
    getUserCompanies(session.user.id, session.user.support),
  ]);
  const menuCompanies = await Promise.all(
    companies.map(async (company) => {
      const access = await getCompanyAccess(session.user.id, company.id);
      return {
        id: company.id,
        name: company.name,
        capabilities: menuCapabilities(access),
        teams: company.teams.map((team) => ({ id: team.id, name: team.name })),
      };
    }),
  );

  const rows = await prisma.unavailability.findMany({
    where: { userId: { in: audience.people.map((person) => person.id) } },
    orderBy: { createdAt: "asc" },
  });
  const entries = rows.flatMap((row) => {
    const entry = toUnavailableEntry(row);
    return entry ? [entry] : [];
  });

  return (
    <AppShell companies={menuCompanies}>
      <AvailabilityEditor
        selfId={audience.selfId}
        people={audience.people}
        entries={entries}
        canReview={audience.canReview}
      />
    </AppShell>
  );
}
