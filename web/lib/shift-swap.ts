import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionError, can, canEnterCompany, getCompanyAccess } from "@/lib/permissions";
import { evaluateMinorWarnings, parseMinorRules } from "@/lib/scheduling/minor-rules";
import { workweekStartKey } from "@/lib/scheduling/range";
import { formatHours, onClockMsInRange } from "@/lib/scheduling/totals";

const HORIZON_DAYS = 120;

export type SwapCompany = {
  id: string;
  name: string;
  shiftSwapEnabled: boolean;
  defaultTimezone: string;
  defaultDayWeekStarts: string;
  lockHistoricalSchedule: boolean;
  minorRules: Prisma.JsonValue | null;
  mmsEnabled: boolean;
  mmsAccountSid: string;
  mmsAuthToken: string;
  mmsFromNumber: string;
};

type Db = Prisma.TransactionClient;

type TimedShift = {
  id: string;
  userId: string | null;
  start: Date;
  stop: Date;
  breaks: { start: Date; stop: Date }[];
};

export type ShiftSwapAccess = {
  company: SwapCompany;
  member: boolean;
  canView: boolean;
  canEdit: boolean;
};

export type OfferCard = {
  shiftId: string;
  offerId: string | null;
  jobName: string;
  teamName: string;
  when: string;
  requested: boolean;
};

export type ApprovalCard = {
  claimId: string | null;
  offerId: string | null;
  claimerName: string | null;
  giverName: string | null;
  jobName: string;
  teamName: string;
  when: string;
  claimerHours: string | null;
  giverHours: string | null;
};

export type ShiftSwapBoard = {
  companyName: string;
  canOffer: boolean;
  canReview: boolean;
  canEdit: boolean;
  mine: OfferCard[];
  mineOffers: OfferCard[];
  claimable: OfferCard[];
  approvals: ApprovalCard[];
  unclaimedOffers: ApprovalCard[];
};

function addDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export function dayKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

function zonedStart(dateKey: string, timezone: string) {
  return fromZonedTime(`${dateKey}T00:00:00`, timezone);
}

export function windowsFor(date: Date, timezone: string, weekStarts: string) {
  const key = dayKey(date, timezone);
  const weekKey = workweekStartKey(key, weekStarts);
  return {
    dayStart: zonedStart(key, timezone),
    dayEnd: zonedStart(addDateKey(key, 1), timezone),
    weekStart: zonedStart(weekKey, timezone),
    weekEnd: zonedStart(addDateKey(weekKey, 7), timezone),
  };
}

function toLike(shift: TimedShift, userId: string) {
  return {
    userId,
    start: shift.start.toISOString(),
    stop: shift.stop.toISOString(),
    breaks: shift.breaks.map((item) => ({
      start: item.start.toISOString(),
      stop: item.stop.toISOString(),
    })),
  };
}

export function formatShiftWhen(start: Date, stop: Date, timezone: string) {
  const date = formatInTimeZone(start, timezone, "EEE MMM d");
  const time = `${formatInTimeZone(start, timezone, "h:mm a")}–${formatInTimeZone(stop, timezone, "h:mm a")}`;
  return `${date} · ${time}`;
}

export function hoursLabel(dayMs: number, weekMs: number) {
  return `Day ${formatHours(dayMs)}h · Week ${formatHours(weekMs)}h`;
}

function hoursFor(
  userId: string,
  shifts: TimedShift[],
  target: TimedShift,
  includeTarget: boolean,
  timezone: string,
  weekStarts: string,
) {
  const bounds = windowsFor(target.start, timezone, weekStarts);
  const mine = shifts.filter(
    (shift) => shift.userId === userId && (includeTarget || shift.id !== target.id),
  );
  const list =
    includeTarget && !mine.some((shift) => shift.id === target.id)
      ? [...mine, { ...target, userId }]
      : mine;
  const likes = list.map((shift) => toLike(shift, userId));
  const day = likes.reduce((sum, shift) => sum + onClockMsInRange(shift, bounds.dayStart, bounds.dayEnd), 0);
  const week = likes.reduce(
    (sum, shift) => sum + onClockMsInRange(shift, bounds.weekStart, bounds.weekEnd),
    0,
  );
  return hoursLabel(day, week);
}

export async function shiftSwapAccess(userId: string, companyId: string): Promise<ShiftSwapAccess> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      archived: true,
      shiftSwapEnabled: true,
      defaultTimezone: true,
      defaultDayWeekStarts: true,
      lockHistoricalSchedule: true,
      minorRules: true,
      mmsEnabled: true,
      mmsAccountSid: true,
      mmsAuthToken: true,
      mmsFromNumber: true,
    },
  });
  if (!company || company.archived) throw new ActionError("Company not found.");
  if (!company.shiftSwapEnabled) throw new ActionError("Shift swapping is not enabled.");

  const [access, loan] = await Promise.all([
    getCompanyAccess(userId, companyId),
    prisma.employeeLoan.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { active: true },
    }),
  ]);
  const member = access.support || access.inDirectory || Boolean(loan?.active);
  const canView = can(access, "shiftSwap", "view") || access.support;
  const canEdit = can(access, "shiftSwap", "edit") || access.support;
  if (!member && !canView && !canEnterCompany(access)) {
    throw new ActionError("You do not have permission to do that.");
  }
  if (!member && !canView) {
    throw new ActionError("You do not have permission to do that.");
  }
  return { company, member, canView, canEdit };
}

export async function assertCanParticipate(userId: string, companyId: string) {
  const access = await getCompanyAccess(userId, companyId);
  if (access.support) return;
  if (access.inDirectory) {
    const row = await prisma.directory.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { deactivated: true },
    });
    if (!row || row.deactivated) {
      throw new ActionError("Your account is deactivated at this company.");
    }
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { homeCompanyId: true },
  });
  if (!user?.homeCompanyId) return;
  const home = await prisma.directory.findUnique({
    where: { companyId_userId: { companyId: user.homeCompanyId, userId } },
    select: { deactivated: true },
  });
  if (home?.deactivated) throw new ActionError("Your account is deactivated.");
}

const shiftInclude = {
  breaks: true,
  job: true,
  team: { select: { id: true, name: true, companyId: true } },
  user: { select: { id: true, name: true, phoneNumber: true } },
} satisfies Prisma.ShiftInclude;

export async function loadOwnedShift(db: Db, companyId: string, shiftId: string) {
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    include: shiftInclude,
  });
  if (!shift || shift.team.companyId !== companyId) {
    throw new ActionError("Shift not found.");
  }
  return shift;
}

export async function assertClaimEligible(
  db: Db,
  company: Pick<SwapCompany, "id" | "defaultTimezone" | "defaultDayWeekStarts" | "minorRules">,
  shift: TimedShift & { jobId: string | null },
  claimerId: string,
) {
  if (!shift.jobId) throw new ActionError("A shift with no job cannot be claimed.");
  const job = await db.job.findUnique({
    where: { id: shift.jobId },
    include: { team: { select: { companyId: true } } },
  });
  if (!job || job.archived || job.team.companyId !== company.id) {
    throw new ActionError("That job is not available.");
  }
  const assigned = await db.employeeJob.findUnique({
    where: { userId_jobId: { userId: claimerId, jobId: shift.jobId } },
    select: { userId: true },
  });
  if (!assigned) throw new ActionError("You are not assigned to this job.");

  const overlap = await db.shift.findFirst({
    where: {
      userId: claimerId,
      id: { not: shift.id },
      start: { lt: shift.stop },
      stop: { gt: shift.start },
    },
    select: { id: true },
  });
  if (overlap) throw new ActionError("You already have a shift at that time.");

  const bounds = windowsFor(shift.start, company.defaultTimezone, company.defaultDayWeekStarts);
  const weekShifts = await db.shift.findMany({
    where: {
      userId: claimerId,
      id: { not: shift.id },
      start: { lt: bounds.weekEnd },
      stop: { gt: bounds.weekStart },
    },
    include: { breaks: true },
  });
  const claimer = await db.user.findUnique({
    where: { id: claimerId },
    select: { birthDate: true },
  });
  const candidate: TimedShift = { ...shift, userId: claimerId };
  const likes = [...weekShifts.map((item) => toLike(item, claimerId)), toLike(candidate, claimerId)];
  const warnings = evaluateMinorWarnings(likes[likes.length - 1]!, likes, parseMinorRules(company.minorRules), {
    birthDate: claimer?.birthDate,
    timezone: company.defaultTimezone,
    weekStart: bounds.weekStart,
    weekEnd: bounds.weekEnd,
  });
  if (warnings.length > 0) throw new ActionError(warnings[0]!.message);
}

export function assertOfferDay(day: string, today: string) {
  if (day <= today) throw new ActionError("Only shifts after today can be offered.");
}

export function assertEmployeeClaimDay(day: string, today: string) {
  if (day <= today) throw new ActionError("Same-day and earlier shifts cannot be swapped.");
}

export function assertOpenClaimDay(day: string, today: string) {
  if (day < today) throw new ActionError("Earlier days cannot be claimed.");
}

export function assertApprovalDay(day: string, today: string, hasOwner: boolean) {
  if (day < today) throw new ActionError("Earlier days cannot be approved.");
  if (day === today && hasOwner) {
    throw new ActionError("Same-day employee swaps cannot be approved.");
  }
}

export async function eligibleRecipients(
  companyId: string,
  jobId: string,
  shift: { id: string; start: Date; stop: Date },
  excludeUserIds: string[],
) {
  const [directory, loans] = await Promise.all([
    prisma.directory.findMany({
      where: { companyId, deactivated: false },
      select: {
        user: { select: { id: true, name: true, phoneNumber: true, homeCompanyId: true } },
      },
    }),
    prisma.employeeLoan.findMany({
      where: { companyId, active: true },
      select: {
        user: { select: { id: true, name: true, phoneNumber: true, homeCompanyId: true } },
      },
    }),
  ]);
  const people = new Map<string, { id: string; phoneNumber: string | null; homeCompanyId: string | null }>();
  for (const row of [...directory, ...loans]) {
    if (!people.has(row.user.id)) people.set(row.user.id, row.user);
  }
  for (const id of excludeUserIds) people.delete(id);
  const ids = [...people.keys()];
  if (ids.length === 0) return [];

  const homeIds = [...new Set(ids.map((id) => people.get(id)?.homeCompanyId).filter(Boolean))] as string[];
  const [jobs, overlaps, homes, deactivatedHere] = await Promise.all([
    prisma.employeeJob.findMany({
      where: { jobId, userId: { in: ids } },
      select: { userId: true },
    }),
    prisma.shift.findMany({
      where: {
        userId: { in: ids },
        id: { not: shift.id },
        start: { lt: shift.stop },
        stop: { gt: shift.start },
      },
      select: { userId: true },
    }),
    homeIds.length
      ? prisma.directory.findMany({
          where: { deactivated: true, userId: { in: ids }, companyId: { in: homeIds } },
          select: { userId: true, companyId: true },
        })
      : Promise.resolve([]),
    prisma.directory.findMany({
      where: { companyId, deactivated: true, userId: { in: ids } },
      select: { userId: true },
    }),
  ]);
  const hasJob = new Set(jobs.map((row) => row.userId));
  const busy = new Set(overlaps.map((row) => row.userId).filter(Boolean));
  const blocked = new Set([
    ...homes
      .filter((row) => people.get(row.userId)?.homeCompanyId === row.companyId)
      .map((row) => row.userId),
    ...deactivatedHere.map((row) => row.userId),
  ]);
  return [...people.values()].filter(
    (person) => hasJob.has(person.id) && !busy.has(person.id) && !blocked.has(person.id),
  );
}

export async function loadShiftSwapBoard(userId: string, companyId: string): Promise<ShiftSwapBoard> {
  const access = await shiftSwapAccess(userId, companyId);
  const { company } = access;
  const timezone = company.defaultTimezone || "UTC";
  const today = dayKey(new Date(), timezone);
  const rangeStart = zonedStart(today, timezone);
  const rangeEnd = addDays(rangeStart, HORIZON_DAYS);

  const [shifts, offers, claims, myClaims] = await Promise.all([
    prisma.shift.findMany({
      where: {
        published: true,
        team: { companyId },
        start: { gte: rangeStart, lt: rangeEnd },
      },
      include: {
        breaks: true,
        job: { select: { id: true, name: true, archived: true } },
        team: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { start: "asc" },
    }),
    prisma.shiftSwapOffer.findMany({
      where: { companyId, status: "open" },
      include: { offeredBy: { select: { id: true, name: true } } },
    }),
    prisma.shiftSwapClaim.findMany({
      where: { companyId, status: "pending" },
      include: { claimer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shiftSwapClaim.findMany({
      where: { companyId, claimerUserId: userId, status: "pending" },
      select: { shiftId: true },
    }),
  ]);

  const offerByShift = new Map(offers.map((offer) => [offer.shiftId, offer]));
  const requested = new Set(myClaims.map((claim) => claim.shiftId));
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));

  const card = (
    shift: (typeof shifts)[number],
    offerId: string | null,
    isRequested: boolean,
  ): OfferCard => ({
    shiftId: shift.id,
    offerId,
    jobName: shift.job?.name || "No job",
    teamName: shift.team.name,
    when: formatShiftWhen(shift.start, shift.stop, timezone),
    requested: isRequested,
  });

  const mine = shifts
    .filter((shift) => shift.userId === userId && dayKey(shift.start, timezone) > today && !offerByShift.has(shift.id))
    .map((shift) => card(shift, null, false));
  const mineOffers = shifts
    .filter((shift) => offerByShift.get(shift.id)?.offeredByUserId === userId)
    .map((shift) => card(shift, offerByShift.get(shift.id)!.id, false));

  const claimable: OfferCard[] = [];
  for (const shift of shifts) {
    if (shift.userId === userId) continue;
    const offer = offerByShift.get(shift.id);
    const day = dayKey(shift.start, timezone);
    const openOffer = offer && shift.userId === offer.offeredByUserId && day > today;
    const unassigned = !shift.userId && !offer && shift.jobId && !shift.job?.archived && day >= today;
    if (!openOffer && !unassigned) continue;
    if (!access.member) continue;
    try {
      await assertClaimEligible(prisma as unknown as Db, company, shift, userId);
    } catch {
      continue;
    }
    claimable.push(card(shift, offer?.id ?? null, requested.has(shift.id)));
  }

  const involved = new Set<string>();
  let hoursFrom = rangeEnd;
  let hoursTo = rangeStart;
  for (const claim of claims) {
    involved.add(claim.claimerUserId);
    const shift = shiftById.get(claim.shiftId);
    if (!shift) continue;
    if (shift.userId) involved.add(shift.userId);
    const bounds = windowsFor(shift.start, timezone, company.defaultDayWeekStarts);
    if (bounds.weekStart < hoursFrom) hoursFrom = bounds.weekStart;
    if (bounds.weekEnd > hoursTo) hoursTo = bounds.weekEnd;
  }
  const hourShifts =
    involved.size === 0
      ? []
      : await prisma.shift.findMany({
          where: {
            userId: { in: [...involved] },
            start: { lt: hoursTo },
            stop: { gt: hoursFrom },
          },
          include: { breaks: true },
        });

  const approvals: ApprovalCard[] = [];
  if (access.canView) {
    for (const claim of claims) {
      const shift = shiftById.get(claim.shiftId);
      if (!shift) continue;
      const offer = offerByShift.get(shift.id);
      const giverId = shift.userId;
      approvals.push({
        claimId: claim.id,
        offerId: offer?.id ?? null,
        claimerName: claim.claimer.name || "Employee",
        giverName: giverId ? shift.user?.name || "Employee" : null,
        jobName: shift.job?.name || "No job",
        teamName: shift.team.name,
        when: formatShiftWhen(shift.start, shift.stop, timezone),
        claimerHours: hoursFor(
          claim.claimerUserId,
          hourShifts,
          shift,
          true,
          timezone,
          company.defaultDayWeekStarts,
        ),
        giverHours: giverId
          ? hoursFor(giverId, hourShifts, shift, false, timezone, company.defaultDayWeekStarts)
          : null,
      });
    }
  }

  const claimedShiftIds = new Set(claims.map((claim) => claim.shiftId));
  const unclaimedOffers: ApprovalCard[] = [];
  if (access.canView) {
    for (const offer of offers) {
      if (claimedShiftIds.has(offer.shiftId)) continue;
      const shift = shiftById.get(offer.shiftId);
      if (!shift || shift.userId !== offer.offeredByUserId) continue;
      unclaimedOffers.push({
        claimId: null,
        offerId: offer.id,
        claimerName: null,
        giverName: offer.offeredBy.name || "Employee",
        jobName: shift.job?.name || "No job",
        teamName: shift.team.name,
        when: formatShiftWhen(shift.start, shift.stop, timezone),
        claimerHours: null,
        giverHours: null,
      });
    }
  }

  return {
    companyName: company.name,
    canOffer: access.member,
    canReview: access.canView,
    canEdit: access.canEdit,
    mine,
    mineOffers,
    claimable,
    approvals,
    unclaimedOffers,
  };
}
