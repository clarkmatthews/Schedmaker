import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
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

export default async function SchedulingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; teamId: string }>;
  searchParams: Promise<{ view?: string; date?: string; week?: string }>;
}) {
  const { companyId, teamId } = await params;
  const { view: viewParam, date: dateParam, week } = await searchParams;
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
        include: { hoursTemplate: { include: { days: true } } },
      },
    },
  });
  if (!team) notFound();

  const mealRules = parseMealRules(team.company.mealRules);
  const overtimeRules = parseOvertimeRules(team.company.overtimeRules);
  const hoursTemplate = team.company.hoursTemplate
    ? toHoursTemplateView(team.company.hoursTemplate)
    : null;

  const view = parseView(viewParam);
  const anchor = parseDateParam(dateParam ?? week);
  const weekBounds = weekRange(anchor, team.dayWeekStarts);
  const bounds = view === "day" ? dayRange(anchor) : weekBounds;
  const shifts = await prisma.shift.findMany({
    where: { teamId, start: { gte: weekBounds.start, lt: weekBounds.end } },
    include: {
      user: { include: { directoryEntries: { where: { companyId } } } },
      job: true,
      breaks: true,
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
        .map((worker) => ({
          id: worker.userId,
          name: worker.user.name || worker.user.email,
        }))}
      jobs={team.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        color: job.color,
      }))}
      overtimeEnabled={Boolean(overtimeRules?.enabled)}
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
          };
          const waivedFirst =
            !assignedDeactivated &&
            Boolean(shift.user?.directoryEntries.some((entry) => entry.mealBreakWaiver));
          return {
            ...item,
            warnings: evaluateMealWarnings(item, mealRules, {
              waivedFirst,
              timezone: team.timezone,
            }),
          };
        });
        const splits = allocateOvertime(mapped, overtimeRules, team.timezone);
        return mapped
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
