import { addDays } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, getCompanyAccess } from "@/lib/permissions";
import { parseDateParam, weekRange } from "@/lib/scheduling/range";
import { PrintWeek, buildPrintEmployees } from "@/components/scheduling/print-week";
import { PrintWeekFrame } from "@/components/scheduling/print-week-frame";

export default async function PrintWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; teamId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { companyId, teamId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!can(access, "schedule", "view")) redirect("/account");
  const canEditSchedule = can(access, "schedule", "edit");
  const { date: dateParam } = await searchParams;
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    select: {
      name: true,
      timezone: true,
      company: { select: { defaultDayWeekStarts: true } },
    },
  });
  if (!team) notFound();

  const anchor = parseDateParam(dateParam);
  const weekBounds = weekRange(anchor, team.company.defaultDayWeekStarts);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekBounds.start, index));

  const shifts = await prisma.shift.findMany({
    where: {
      teamId,
      userId: canEditSchedule ? { not: null } : session.user.id,
      ...(canEditSchedule ? {} : { published: true }),
      start: { gte: weekBounds.start, lt: weekBounds.end },
    },
    include: {
      user: {
        include: { directoryEntries: { where: { companyId } } },
      },
      breaks: { orderBy: { start: "asc" } },
    },
    orderBy: { start: "asc" },
  });

  const assigned = shifts.flatMap((shift) => {
    if (!shift.userId || !shift.user) return [];
    if (shift.user.directoryEntries.some((entry) => entry.deactivated)) return [];
    return [
      {
        userId: shift.userId,
        userName: shift.user.name || shift.user.email,
        start: shift.start.toISOString(),
        stop: shift.stop.toISOString(),
        breakStarts: shift.breaks.map((item) => item.start.toISOString()),
      },
    ];
  });

  return (
    <PrintWeekFrame>
      <PrintWeek
        teamName={team.name}
        timezone={team.timezone}
        weekStartIso={weekBounds.start.toISOString()}
        employees={buildPrintEmployees(assigned, weekDays, team.timezone)}
      />
    </PrintWeekFrame>
  );
}
