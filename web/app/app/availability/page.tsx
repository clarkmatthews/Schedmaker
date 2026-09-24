import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { availabilityAudience } from "@/lib/availability-access";
import { ActionError, listMenuCompanies } from "@/lib/permissions";
import { toUnavailableEntry } from "@/lib/scheduling/availability";
import { AppShell } from "@/components/app/app-shell";
import { AvailabilityEditor } from "@/components/availability/availability-editor";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const menuCompanies = await listMenuCompanies(session.user.id, session.user.support);
  let audience;
  try {
    audience = await availabilityAudience(session.user.id);
  } catch (error) {
    if (error instanceof ActionError && error.message === "Availability is not enabled.") notFound();
    throw error;
  }

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
