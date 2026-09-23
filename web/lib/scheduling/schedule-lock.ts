import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";

export async function getScheduleLock(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { lockHistoricalSchedule: true, defaultTimezone: true },
  });
  const timezone = company?.defaultTimezone || "UTC";
  return {
    locked: Boolean(company?.lockHistoricalSchedule),
    timezone,
    today: formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"),
  };
}

export function shiftDayKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function isLockedScheduleDay(day: string, today: string, locked: boolean) {
  return locked && day <= today;
}

export async function assertScheduleDayEditable(
  companyId: string,
  teamId: string,
  dates: Date[],
) {
  const lock = await getScheduleLock(companyId);
  if (!lock.locked) return;

  for (const date of dates) {
    const day = shiftDayKey(date, lock.timezone);
    if (isLockedScheduleDay(day, lock.today, true)) {
      throw new Error(
        "This location does not allow schedule changes on today or earlier dates.",
      );
    }
  }
}
