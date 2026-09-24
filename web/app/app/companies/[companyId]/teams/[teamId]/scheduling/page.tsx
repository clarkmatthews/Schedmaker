import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can, getCompanyAccess } from "@/lib/permissions";
import { dayRange, parseDateParam, weekRange } from "@/lib/scheduling/range";
import { parseView } from "@/lib/scheduling/views";
import { CalendarShell } from "@/components/scheduling/calendar-shell";
import { toHoursTemplateView } from "@/lib/scheduling/hours";
import { resolvePayRate } from "@/lib/scheduling/totals";
import {
  allocateOvertime,
  evaluateMealWarnings,
  parseMealRules,
  parseOvertimeRules,
} from "@/lib/scheduling/labor-rules";
import { evaluateMinorWarnings, parseMinorRules } from "@/lib/scheduling/minor-rules";
import {
  evaluateAvailabilityWarnings,
  toUnavailableEntry,
} from "@/lib/scheduling/availability";

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
            include: {
              directoryEntries: {
                where: { companyId },
                select: { companyId: true, deactivated: true, hourlyRate: true, mealBreakWaiver: true },
              },
            },
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
  const timezone = team.company.defaultTimezone;
  const weekBounds = weekRange(anchor, weekStarts);
  const bounds = view === "day" ? dayRange(anchor) : weekBounds;
  const [shifts, loans] = await Promise.all([
    prisma.shift.findMany({
      where: {
        teamId,
        start: { gte: weekBounds.start, lt: weekBounds.end },
        ...(canEditSchedule
          ? {}
          : { userId: session.user.id, published: true }),
      },
      include: {
        user: {
          include: {
            directoryEntries: {
              select: { companyId: true, deactivated: true, mealBreakWaiver: true, hourlyRate: true },
            },
          },
        },
        job: true,
        breaks: true,
        responsibilities: { select: { responsibilityId: true } },
      },
      orderBy: { start: "asc" },
    }),
    prisma.employeeLoan.findMany({
      where: { companyId, active: true },
      include: {
        user: {
          include: {
            directoryEntries: {
              select: { companyId: true, deactivated: true, mealBreakWaiver: true, hourlyRate: true },
            },
          },
        },
      },
    }),
  ]);

  const directoryEntry = (
    entries: { companyId: string; deactivated: boolean; mealBreakWaiver: boolean; hourlyRate: unknown }[],
    entryCompanyId: string | null | undefined,
  ) => entries.find((entry) => entry.companyId === entryCompanyId);

  const workers: {
    id: string;
    name: string;
    loaned: boolean;
    assignable: boolean;
    homeCompanyId: string | null;
    homeCompanyName: string | null;
    hourlyRate: number | null;
  }[] = [];
  const seen = new Set<string>();
  for (const worker of team.workers) {
    const local = directoryEntry(worker.user.directoryEntries, companyId);
    if (local?.deactivated) continue;
    if (!canEditSchedule && worker.userId !== session.user.id) continue;
    seen.add(worker.userId);
    const rate = local?.hourlyRate == null ? null : Number(local.hourlyRate);
    workers.push({
      id: worker.userId,
      name: worker.user.name || worker.user.email,
      loaned: false,
      assignable: true,
      homeCompanyId: worker.user.homeCompanyId,
      homeCompanyName: null,
      hourlyRate: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    });
  }
  for (const loan of loans) {
    if (seen.has(loan.userId)) continue;
    const home = directoryEntry(loan.user.directoryEntries, loan.user.homeCompanyId);
    if (home?.deactivated) continue;
    if (!canEditSchedule && loan.userId !== session.user.id) continue;
    seen.add(loan.userId);
    const rate = home?.hourlyRate == null ? null : Number(home.hourlyRate);
    workers.push({
      id: loan.userId,
      name: loan.user.name || loan.user.email,
      loaned: true,
      assignable: true,
      homeCompanyId: loan.user.homeCompanyId,
      homeCompanyName: null,
      hourlyRate: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    });
  }
  for (const shift of shifts) {
    const user = shift.user;
    if (!user || seen.has(user.id)) continue;
    const local = directoryEntry(user.directoryEntries, companyId);
    if (local?.deactivated) continue;
    const loanedHere = Boolean(user.homeCompanyId && user.homeCompanyId !== companyId && !local);
    if (!loanedHere) continue;
    if (!canEditSchedule && user.id !== session.user.id) continue;
    seen.add(user.id);
    const home = directoryEntry(user.directoryEntries, user.homeCompanyId);
    const rate = home?.hourlyRate == null ? null : Number(home.hourlyRate);
    workers.push({
      id: user.id,
      name: user.name || user.email,
      loaned: true,
      assignable: false,
      homeCompanyId: user.homeCompanyId,
      homeCompanyName: null,
      hourlyRate: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    });
  }

  const homeIds = [...new Set(workers.map((worker) => worker.homeCompanyId).filter(Boolean))] as string[];
  const boardUserIds = workers.map((worker) => worker.id);
  const [homeCompanies, assignmentRows] = await Promise.all([
    homeIds.length
      ? prisma.company.findMany({
          where: { id: { in: homeIds } },
          select: { id: true, name: true },
        })
      : [],
    boardUserIds.length
      ? prisma.employeeJob.findMany({
          where: { userId: { in: boardUserIds }, job: { archived: false } },
          select: {
            userId: true,
            primary: true,
            job: { select: { id: true, name: true, color: true, teamId: true, hourlyRate: true } },
          },
          orderBy: { job: { name: "asc" } },
        })
      : [],
  ]);
  const jobsByUser = new Map<
    string,
    { id: string; name: string; color: string; teamId: string; primary: boolean; hourlyRate: number | null }[]
  >();
  for (const row of assignmentRows) {
    const list = jobsByUser.get(row.userId) ?? [];
    const rate = row.job.hourlyRate == null ? null : Number(row.job.hourlyRate);
    list.push({
      id: row.job.id,
      name: row.job.name,
      color: row.job.color,
      teamId: row.job.teamId,
      primary: row.primary,
      hourlyRate: rate != null && Number.isFinite(rate) ? rate : null,
    });
    jobsByUser.set(row.userId, list);
  }
  const homeNames = new Map(homeCompanies.map((company) => [company.id, company.name]));
  for (const worker of workers) {
    worker.homeCompanyName = worker.homeCompanyId
      ? (homeNames.get(worker.homeCompanyId) ?? null)
      : null;
  }

  const scheduledWorkers = workers.filter((worker) =>
    (jobsByUser.get(worker.id) ?? []).some((job) => worker.loaned || job.teamId === teamId),
  );

  const boardIds = scheduledWorkers.map((worker) => worker.id);
  const availabilityUserIds = [
    ...new Set([
      ...boardIds,
      ...shifts.flatMap((shift) => (shift.userId ? [shift.userId] : [])),
    ]),
  ];
  const availabilitySettings = await prisma.company.findUnique({
    where: { id: companyId },
    select: { availabilityEnabled: true },
  });
  const availabilityOn = Boolean(availabilitySettings?.availabilityEnabled);
  const [externalShifts, unavailabilityRows] = await Promise.all([
    boardIds.length
      ? prisma.shift.findMany({
          where: {
            userId: { in: boardIds },
            start: { lt: weekBounds.end },
            stop: { gt: weekBounds.start },
            team: { companyId: { not: companyId } },
          },
          include: {
            breaks: true,
            team: { select: { company: { select: { name: true } } } },
          },
        })
      : [],
    availabilityOn && availabilityUserIds.length
      ? prisma.unavailability.findMany({
          where: { userId: { in: availabilityUserIds } },
        })
      : [],
  ]);
  const unavailability = unavailabilityRows.flatMap((row) => {
    const entry = toUnavailableEntry(row);
    return entry ? [entry] : [];
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
      timezone={timezone}
      hoursTemplate={hoursTemplate}
      workers={scheduledWorkers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        loaned: worker.loaned,
        homeCompanyName: worker.homeCompanyName,
        assignable: worker.assignable,
        jobs: (jobsByUser.get(worker.id) ?? [])
          .filter((job) => worker.loaned || job.teamId === teamId)
          .map((job) => ({ id: job.id, name: job.name, color: job.color, primary: job.primary })),
        primaryJobId:
          (jobsByUser.get(worker.id) ?? []).find(
            (job) => job.primary && (worker.loaned || job.teamId === teamId),
          )?.id ?? null,
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
      unavailability={unavailability}
      overtimeEnabled={Boolean(overtimeRules?.enabled)}
      responsibilitiesEnabled={team.company.responsibilitiesEnabled}
      shifts={(() => {
        const workerById = new Map(scheduledWorkers.map((worker) => [worker.id, worker]));
        const mapped = shifts.map((shift) => {
          const local = shift.user?.directoryEntries.find((entry) => entry.companyId === companyId);
          const home = shift.user?.directoryEntries.find(
            (entry) => entry.companyId === shift.user?.homeCompanyId,
          );
          const assignedDeactivated = Boolean(local?.deactivated);
          const roster = shift.userId ? workerById.get(shift.userId) : undefined;
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
            loaned: Boolean(roster?.loaned),
            homeCompanyName: roster?.homeCompanyName ?? null,
            payRate: resolvePayRate(
              roster?.hourlyRate,
              shift.job?.hourlyRate == null ? null : Number(shift.job.hourlyRate),
            ),
          };
          const waivedFirst =
            !assignedDeactivated &&
            Boolean((local ?? home)?.mealBreakWaiver);
          const birthDate = assignedDeactivated ? null : (shift.user?.birthDate ?? null);
          const mealWarnings = evaluateMealWarnings(item, mealRules, {
            waivedFirst,
            timezone,
          });
          return { item, mealWarnings, birthDate };
        });
        const otherRuleShifts = externalShifts
          .filter((shift) => {
            const start = shift.start.getTime();
            return start >= weekBounds.start.getTime() && start < weekBounds.end.getTime();
          })
          .map((shift) => ({
            id: shift.id,
            start: shift.start.toISOString(),
            stop: shift.stop.toISOString(),
            userId: shift.userId,
            breaks: shift.breaks.map((item) => ({
              start: item.start.toISOString(),
              stop: item.stop.toISOString(),
            })),
          }));
        const weekShifts = [...mapped.map((row) => row.item), ...otherRuleShifts];
        const withWarnings = mapped.map(({ item, mealWarnings, birthDate }) => ({
          ...item,
          warnings: [
            ...mealWarnings,
            ...evaluateMinorWarnings(item, weekShifts, minorRules, {
              birthDate,
              timezone,
              weekStart: weekBounds.start,
              weekEnd: weekBounds.end,
            }),
            ...evaluateAvailabilityWarnings(item, unavailability, timezone),
          ],
        }));
        const splits = allocateOvertime(
          weekShifts,
          overtimeRules,
          timezone,
          weekStarts,
        );
        const localShifts = withWarnings
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
        const otherUnitShifts = externalShifts
          .filter((shift) => {
            const start = shift.start.getTime();
            return start >= bounds.start.getTime() && start < bounds.end.getTime();
          })
          .map((shift) => ({
            id: shift.id,
            start: shift.start.toISOString(),
            stop: shift.stop.toISOString(),
            published: true,
            userId: shift.userId,
            jobId: null,
            userName: null,
            jobName: null,
            jobColor: null,
            breaks: [],
            responsibilityIds: [],
            warnings: [],
            regularMs: 0,
            otMs: 0,
            external: true,
            externalCompanyName: shift.team.company.name,
          }));
        return [...localShifts, ...otherUnitShifts];
      })()}
    />
  );
}
