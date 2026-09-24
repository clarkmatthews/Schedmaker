import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { availabilityAudience } from "@/lib/availability-access";
import { toUnavailableEntry } from "@/lib/scheduling/availability";
import { AvailabilityEditor } from "@/components/availability/availability-editor";

export default async function CompanyAvailabilityPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { companyId } = await params;

  const audience = await availabilityAudience(session.user.id, companyId);
  const rows = await prisma.unavailability.findMany({
    where: { userId: { in: audience.people.map((person) => person.id) } },
    orderBy: { createdAt: "asc" },
  });
  const entries = rows.flatMap((row) => {
    const entry = toUnavailableEntry(row);
    return entry ? [entry] : [];
  });

  return (
    <AvailabilityEditor
      selfId={audience.selfId}
      people={audience.people}
      entries={entries}
      canReview={audience.canReview}
    />
  );
}
