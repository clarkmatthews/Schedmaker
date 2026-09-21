import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { weekRange } from "@/lib/scheduling/range";

export type ScheduleDay = {
  key: string;
  weekday: string;
  dateLabel: string;
  windows: string[];
};

export type WeeklySchedulePayload = {
  companyName: string;
  employeeName: string;
  firstName: string;
  managerPhone: string;
  timezone: string;
  weekStart: Date;
  weekEndInclusive: Date;
  weekLabel: string;
  days: ScheduleDay[];
};

export function employeeFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export function formatWeekLabel(weekStart: Date, weekEndInclusive: Date) {
  return `${format(weekStart, "MMM d")} – ${format(weekEndInclusive, "MMM d, yyyy")}`;
}

export function formatShiftWindow(start: Date, stop: Date, timezone: string) {
  const inTime = formatInTimeZone(start, timezone, "h:mm a");
  const outTime = formatInTimeZone(stop, timezone, "h:mm a");
  return `${inTime} – ${outTime}`;
}

export function publishedWeekBounds(anchor: Date, dayWeekStarts: string) {
  const { start } = weekRange(anchor, dayWeekStarts);
  return { start, end: addDays(start, 7), endInclusive: addDays(start, 6) };
}

export function groupShiftsByDay(
  shifts: { start: Date; stop: Date }[],
  weekStart: Date,
  timezone: string,
): ScheduleDay[] {
  const byKey = new Map<string, string[]>();
  for (const shift of shifts) {
    const key = formatInTimeZone(shift.start, timezone, "yyyy-MM-dd");
    const list = byKey.get(key) ?? [];
    list.push(formatShiftWindow(shift.start, shift.stop, timezone));
    byKey.set(key, list);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const key = formatInTimeZone(day, timezone, "yyyy-MM-dd");
    return {
      key,
      weekday: formatInTimeZone(day, timezone, "EEE").toUpperCase(),
      dateLabel: formatInTimeZone(day, timezone, "d"),
      windows: byKey.get(key) ?? [],
    };
  });
}

export function scheduleMessageBody(payload: WeeklySchedulePayload) {
  return `${payload.companyName}: Hi ${payload.firstName}, your work schedule for the week of ${payload.weekLabel} is attached below. Please review your assigned shifts, tap the image to zoom. Questions? Call the manager on duty at ${payload.managerPhone}.`;
}

export async function loadWeeklySchedule(params: {
  companyId: string;
  teamId: string;
  userId: string;
  weekStart: Date;
}): Promise<WeeklySchedulePayload | null> {
  const weekEnd = addDays(params.weekStart, 7);
  const [company, team, user, shifts] = await Promise.all([
    prisma.company.findUnique({
      where: { id: params.companyId },
      select: { name: true, mmsManagerPhone: true, defaultTimezone: true },
    }),
    prisma.team.findFirst({
      where: { id: params.teamId, companyId: params.companyId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    }),
    prisma.shift.findMany({
      where: {
        teamId: params.teamId,
        userId: params.userId,
        published: true,
        start: { gte: params.weekStart, lt: weekEnd },
      },
      orderBy: { start: "asc" },
      select: { start: true, stop: true },
    }),
  ]);
  if (!company || !team || !user) return null;

  const timezone = company.defaultTimezone || "UTC";
  const endInclusive = addDays(params.weekStart, 6);
  const employeeName = user.name || "there";
  return {
    companyName: company.name,
    employeeName,
    firstName: employeeFirstName(employeeName),
    managerPhone: company.mmsManagerPhone || "the manager on duty",
    timezone,
    weekStart: params.weekStart,
    weekEndInclusive: endInclusive,
    weekLabel: formatWeekLabel(params.weekStart, endInclusive),
    days: groupShiftsByDay(shifts, params.weekStart, timezone),
  };
}
