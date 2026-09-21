import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";

export async function assertScheduleDayEditable(
  companyId: string,
  teamId: string,
  dates: Date[],
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const locked = Boolean(
    company && "lockHistoricalSchedule" in company && company.lockHistoricalSchedule,
  );
  if (!company || !locked) return;

  const timezone = company.defaultTimezone || "UTC";
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  for (const date of dates) {
    const day = formatInTimeZone(date, timezone, "yyyy-MM-dd");
    if (day <= today) {
      throw new Error(
        "This location does not allow schedule changes on today or earlier dates.",
      );
    }
  }
}
