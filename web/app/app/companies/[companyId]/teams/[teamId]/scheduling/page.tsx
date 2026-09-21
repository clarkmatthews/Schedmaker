import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, getCompanyAccess } from "@/lib/permissions";
import { dayRange, parseDateParam, weekRange } from "@/lib/scheduling/range";
import { parseView } from "@/lib/scheduling/views";
import { CalendarShell } from "@/components/scheduling/calendar-shell";
import { toHoursTemplateView } from "@/lib/scheduling/hours";
import {
  allocateOvertime,
  evaluateMealWarnings,
  parseMealRules,
  parseOvertimeRules,
} from "@/lib/scheduling/labor-rules";
import { evaluateMinorWarnings, parseMinorRules } from "@/lib/scheduling/minor-rules";

export default async function SchedulingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; teamId: string }>;
  searchParams: Promise<{ view?: string; date?: string; week?: string }>;
}) {
  const { companyId, teamId } = await params;
  const { view: viewParam, date: dateParam, week } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const access = await getCompanyAccess(session.user.id, companyId);
  if (!can(access, "schedule", "view")) redirect("/account");
  const canEditSchedule = can(access, "schedule", "edit");
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId },
    include: {
      jobs: { where: { archived: false }, orderBy: { name: "asc" } },
      workers: {
        include: {
          user: {
            include: { directoryEntries: { where: { companyId } } },
          },
        },
      },
      company: {
        include: {
          hoursTemplate: { include: { days: true } },
          responsibilities: { orderBy: { name: "asc" } },
        },
      },
    },
  });
  if (!team) notFound();

  const mealRules = parseMealRules(team.company.mealRules);
  const overtimeRules = parseOvertimeRules(team.company.overtimeRules);
  const minorRules = parseMinorRules(team.company.minorRules);
  const hoursTemplate = team.company.hoursTemplate
    ? toHoursTemplateView(team.company.hoursTemplate)
    : null;

  const view = parseView(viewParam);
  const anchor = parseDateParam(dateParam ?? week);
  const weekStarts = team.company.defaultDayWeekStarts;
  const weekBounds = weekRange(anchor, weekStarts);
  const bounds = view === "day" ? dayRange(anchor) : weekBounds;
  const shifts = await prisma.shift.findMany({
    where: {
      teamId,
      start: { gte: weekBounds.start, lt: weekBounds.end },
      ...(canEditSchedule
        ? {}
        : { userId: session.user.id, published: true }),
    },
    include: {
      user: { include: { directoryEntries: { where: { companyId } } } },
      job: true,
      breaks: true,
      responsibilities: { select: { responsibilityId: true } },
    },
    orderBy: { start: "asc" },
  });

  return (
    <CalendarShell
      companyId={companyId}
      teamId={teamId}
      view={view}
      dateIso={anchor.toISOString()}
      weekStartIso={weekBounds.start.toISOString()}
      rangeStartIso={bounds.start.toISOString()}
      rangeEndIso={bounds.end.toISOString()}
      timezone={team.timezone}
      hoursTemplate={hoursTemplate}
      workers={team.workers
        .filter((worker) => !worker.user.directoryEntries.some((entry) => entry.deactivated))
        .filter((worker) => canEditSchedule || worker.userId === session.user.id)
        .map((worker) => ({
          id: worker.userId,
          name: worker.user.name || worker.user.email,
        }))}
      jobs={team.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        color: job.color,
      }))}
      responsibilities={team.company.responsibilities.map((duty) => ({
        id: duty.id,
        name: duty.name,
        archived: duty.archived,
      }))}
      canEdit={canEditSchedule}
      overtimeEnabled={Boolean(overtimeRules?.enabled)}
      responsibilitiesEnabled={team.company.responsibilitiesEnabled}
      hourlyRates={
        canEditSchedule
          ? Object.fromEntries(
              team.workers.flatMap((worker) => {
                const rate = worker.user.directoryEntries[0]?.hourlyRate;
                if (rate == null) return [];
                const value = Number(rate);
                return Number.isFinite(value) && value > 0
                  ? [[worker.userId, value] as const]
                  : [];
              }),
            )
          : {}
      }
      shifts={(() => {
        const mapped = shifts.map((shift) => {
          const assignedDeactivated = Boolean(
            shift.user?.directoryEntries.some((entry) => entry.deactivated),
          );
          const item = {
            id: shift.id,
            start: shift.start.toISOString(),
            stop: shift.stop.toISOString(),
            published: shift.published,
            userId: assignedDeactivated ? null : shift.userId,
            jobId: shift.jobId,
            userName: assignedDeactivated
              ? null
              : shift.user?.name || shift.user?.email || null,
            jobName: shift.job?.name ?? null,
            jobColor: shift.job?.color ?? null,
            breaks: shift.breaks.map((item) => ({
              id: item.id,
              start: item.start.toISOString(),
              stop: item.stop.toISOString(),
            })),
            responsibilityIds: shift.responsibilities.map((row) => row.responsibilityId),
          };
          const waivedFirst =
            !assignedDeactivated &&
            Boolean(shift.user?.directoryEntries.some((entry) => entry.mealBreakWaiver));
          const birthDate = assignedDeactivated ? null : (shift.user?.birthDate ?? null);
          const mealWarnings = evaluateMealWarnings(item, mealRules, {
            waivedFirst,
            timezone: team.timezone,
          });
          return { item, mealWarnings, birthDate };
        });
        const weekShifts = mapped.map((row) => row.item);
        const withWarnings = mapped.map(({ item, mealWarnings, birthDate }) => ({
          ...item,
          warnings: [
            ...mealWarnings,
            ...evaluateMinorWarnings(item, weekShifts, minorRules, {
              birthDate,
              timezone: team.timezone,
              weekStart: weekBounds.start,
              weekEnd: weekBounds.end,
            }),
          ],
        }));
        const splits = allocateOvertime(
          withWarnings,
          overtimeRules,
          team.timezone,
          weekStarts,
        );
        return withWarnings
          .filter((shift) => {
            const start = new Date(shift.start).getTime();
            return start >= bounds.start.getTime() && start < bounds.end.getTime();
          })
          .map((shift) => {
            const split = splits.get(shift.id);
            return {
              ...shift,
              regularMs: split?.regularMs ?? 0,
              otMs: split?.otMs ?? 0,
            };
          });
      })()}
    />
  );
}
