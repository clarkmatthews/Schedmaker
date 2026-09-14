import { addDays, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { ShiftWarning } from "@/lib/scheduling/labor-rules";
import { formatHours, onClockMs } from "@/lib/scheduling/totals";

export type MinorAgeBand = {
  minAge: number;
  maxAge: number;
  schoolDayHours: number;
  nonSchoolDayHours: number;
  schoolWeekHours: number;
  nonSchoolWeekHours: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
  summerLatestEndMinutes?: number;
  latestEndBeforeNonSchoolMinutes?: number;
  dayBeforeNonSchoolUsesNonSchoolHours?: boolean;
};

export type MinorRules = {
  enabled: boolean;
  minWorkAge: number;
  schoolYearStart: string;
  schoolYearEnd: string;
  bands: MinorAgeBand[];
};

const CA_14_15: MinorAgeBand = {
  minAge: 14,
  maxAge: 15,
  schoolDayHours: 3,
  nonSchoolDayHours: 8,
  schoolWeekHours: 18,
  nonSchoolWeekHours: 40,
  earliestStartMinutes: 7 * 60,
  latestEndMinutes: 19 * 60,
  summerLatestEndMinutes: 21 * 60,
};

const CA_16_17: MinorAgeBand = {
  minAge: 16,
  maxAge: 17,
  schoolDayHours: 4,
  nonSchoolDayHours: 8,
  schoolWeekHours: 48,
  nonSchoolWeekHours: 48,
  earliestStartMinutes: 5 * 60,
  latestEndMinutes: 22 * 60,
  latestEndBeforeNonSchoolMinutes: 24 * 60 + 30,
  dayBeforeNonSchoolUsesNonSchoolHours: true,
};

export const CA_MINOR_RULES: MinorRules = {
  enabled: true,
  minWorkAge: 14,
  schoolYearStart: "08-15",
  schoolYearEnd: "06-05",
  bands: [CA_14_15, CA_16_17],
};

export function cloneMinorRules(rules: MinorRules): MinorRules {
  return {
    ...rules,
    bands: rules.bands.map((band) => ({ ...band })),
  };
}

export function minorRulesForState(state: string): MinorRules {
  const rules = cloneMinorRules(CA_MINOR_RULES);
  if (state !== "CA") rules.enabled = false;
  return rules;
}

function asNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseMonthDay(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return fallback;
  return `${match[1]}-${match[2]}`;
}

function parseBand(raw: unknown, fallback: MinorAgeBand): MinorAgeBand {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const value = raw as Record<string, unknown>;
  return {
    minAge: asNumber(value.minAge, fallback.minAge),
    maxAge: asNumber(value.maxAge, fallback.maxAge),
    schoolDayHours: asNumber(value.schoolDayHours, fallback.schoolDayHours),
    nonSchoolDayHours: asNumber(value.nonSchoolDayHours, fallback.nonSchoolDayHours),
    schoolWeekHours: asNumber(value.schoolWeekHours, fallback.schoolWeekHours),
    nonSchoolWeekHours: asNumber(value.nonSchoolWeekHours, fallback.nonSchoolWeekHours),
    earliestStartMinutes: asNumber(value.earliestStartMinutes, fallback.earliestStartMinutes),
    latestEndMinutes: asNumber(value.latestEndMinutes, fallback.latestEndMinutes),
    summerLatestEndMinutes:
      asOptionalNumber(value.summerLatestEndMinutes) ?? fallback.summerLatestEndMinutes,
    latestEndBeforeNonSchoolMinutes:
      asOptionalNumber(value.latestEndBeforeNonSchoolMinutes) ??
      fallback.latestEndBeforeNonSchoolMinutes,
    dayBeforeNonSchoolUsesNonSchoolHours:
      value.dayBeforeNonSchoolUsesNonSchoolHours == null
        ? Boolean(fallback.dayBeforeNonSchoolUsesNonSchoolHours)
        : Boolean(value.dayBeforeNonSchoolUsesNonSchoolHours),
  };
}

export function parseMinorRules(value: unknown): MinorRules | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const defaults = CA_MINOR_RULES.bands;
  const bandsRaw = Array.isArray(raw.bands) ? raw.bands : [];
  return {
    enabled: Boolean(raw.enabled),
    minWorkAge: asNumber(raw.minWorkAge, CA_MINOR_RULES.minWorkAge),
    schoolYearStart: parseMonthDay(raw.schoolYearStart, CA_MINOR_RULES.schoolYearStart),
    schoolYearEnd: parseMonthDay(raw.schoolYearEnd, CA_MINOR_RULES.schoolYearEnd),
    bands: defaults.map((fallback, index) => parseBand(bandsRaw[index], fallback)),
  };
}

function monthDayNumber(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);
  return month * 100 + day;
}

function dateKeyMonthDay(dateKey: string) {
  const [, month, day] = dateKey.split("-").map(Number);
  return month * 100 + day;
}

export function inSchoolYearRange(dateKey: string, start: string, end: string) {
  const md = dateKeyMonthDay(dateKey);
  const startMd = monthDayNumber(start);
  const endMd = monthDayNumber(end);
  if (startMd <= endMd) return md >= startMd && md <= endMd;
  return md >= startMd || md <= endMd;
}

function weekdayFromDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export function isSchoolDay(dateKey: string, rules: MinorRules) {
  const weekday = weekdayFromDateKey(dateKey);
  if (weekday === 0 || weekday === 6) return false;
  return inSchoolYearRange(dateKey, rules.schoolYearStart, rules.schoolYearEnd);
}

function addDateKeyDays(dateKey: string, days: number) {
  return addDays(parseISO(`${dateKey}T12:00:00Z`), days).toISOString().slice(0, 10);
}

function laborDayMonthDay(year: number) {
  const weekday = new Date(Date.UTC(year, 8, 1)).getUTCDay();
  const day = weekday === 1 ? 1 : ((8 - weekday) % 7) + 1;
  return 900 + day;
}

export function inSummerCurfewWindow(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const md = dateKeyMonthDay(dateKey);
  return md >= 601 && md <= laborDayMonthDay(year);
}

export function ageOnDate(birthDate: Date, dateKey: string) {
  const birthKey = birthDate.toISOString().slice(0, 10);
  const [birthYear, birthMonth, birthDay] = birthKey.split("-").map(Number);
  const [year, month, day] = dateKey.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age;
}

function dayKey(start: string, timezone: string) {
  return formatInTimeZone(parseISO(start), timezone, "yyyy-MM-dd");
}

function minutesFromDayStart(iso: string, dateKey: string, timezone: string) {
  const midnight = fromZonedTime(`${dateKey}T00:00:00`, timezone);
  return (parseISO(iso).getTime() - midnight.getTime()) / 60_000;
}

function clockFromMinutes(dateKey: string, minutes: number, timezone: string) {
  const days = Math.floor(minutes / 1_440);
  const remainder = ((minutes % 1_440) + 1_440) % 1_440;
  const hours = String(Math.floor(remainder / 60)).padStart(2, "0");
  const mins = String(Math.round(remainder % 60)).padStart(2, "0");
  const instant = addDays(fromZonedTime(`${dateKey}T${hours}:${mins}:00`, timezone), days);
  return formatInTimeZone(instant, timezone, "h:mm a");
}

function latestAllowedMinutes(band: MinorAgeBand, dateKey: string, rules: MinorRules) {
  const nextKey = addDateKeyDays(dateKey, 1);
  if (
    band.latestEndBeforeNonSchoolMinutes != null &&
    !isSchoolDay(nextKey, rules)
  ) {
    return band.latestEndBeforeNonSchoolMinutes;
  }
  if (band.summerLatestEndMinutes != null && inSummerCurfewWindow(dateKey)) {
    return band.summerLatestEndMinutes;
  }
  return band.latestEndMinutes;
}

function dailyHourCap(band: MinorAgeBand, dateKey: string, rules: MinorRules) {
  const schoolDay = isSchoolDay(dateKey, rules);
  const nextIsSchool = isSchoolDay(addDateKeyDays(dateKey, 1), rules);
  if (band.dayBeforeNonSchoolUsesNonSchoolHours && !nextIsSchool) {
    return band.nonSchoolDayHours;
  }
  return schoolDay ? band.schoolDayHours : band.nonSchoolDayHours;
}

function weekOverlapsSchoolYear(
  weekStart: Date,
  weekEnd: Date,
  rules: MinorRules,
  timezone: string,
) {
  const lastInstant = new Date(weekEnd.getTime() - 1);
  let key = formatInTimeZone(weekStart, timezone, "yyyy-MM-dd");
  const endKey = formatInTimeZone(lastInstant, timezone, "yyyy-MM-dd");
  while (key <= endKey) {
    if (inSchoolYearRange(key, rules.schoolYearStart, rules.schoolYearEnd)) return true;
    key = addDateKeyDays(key, 1);
  }
  return false;
}

type ShiftLike = {
  start: string;
  stop: string;
  userId?: string | null;
  breaks: { start: string; stop: string }[];
};

export function evaluateMinorWarnings(
  shift: ShiftLike,
  weekShifts: ShiftLike[],
  rules: MinorRules | null,
  options: {
    birthDate?: Date | string | null;
    timezone: string;
    weekStart: Date;
    weekEnd: Date;
  },
): ShiftWarning[] {
  if (!rules?.enabled || !shift.userId || !options.birthDate) return [];

  const birthDate =
    options.birthDate instanceof Date ? options.birthDate : new Date(options.birthDate);
  if (Number.isNaN(birthDate.getTime())) return [];

  const dateKey = dayKey(shift.start, options.timezone);
  const age = ageOnDate(birthDate, dateKey);
  if (age >= 18) return [];

  if (age < rules.minWorkAge) {
    return [
      {
        code: "minor_underage",
        message: `Employees under ${rules.minWorkAge} generally cannot be scheduled.`,
      },
    ];
  }

  const band = rules.bands.find((item) => age >= item.minAge && age <= item.maxAge);
  if (!band) return [];

  const warnings: ShiftWarning[] = [];
  const userShifts = weekShifts.filter((item) => item.userId === shift.userId);
  const dailyMs = userShifts
    .filter((item) => dayKey(item.start, options.timezone) === dateKey)
    .reduce((sum, item) => sum + onClockMs(item), 0);
  const weeklyMs = userShifts.reduce((sum, item) => sum + onClockMs(item), 0);
  const dailyMax = dailyHourCap(band, dateKey, rules);
  const schoolWeek = weekOverlapsSchoolYear(
    options.weekStart,
    options.weekEnd,
    rules,
    options.timezone,
  );
  const weeklyMax = schoolWeek ? band.schoolWeekHours : band.nonSchoolWeekHours;

  if (dailyMs / 3_600_000 > dailyMax + 1e-6) {
    warnings.push({
      code: "minor_daily_hours",
      message: `Minor daily limit: ${formatHours(dailyMs)} hours scheduled; ${dailyMax} hours allowed.`,
    });
  }

  if (weeklyMs / 3_600_000 > weeklyMax + 1e-6) {
    warnings.push({
      code: "minor_weekly_hours",
      message: `Minor weekly limit: ${formatHours(weeklyMs)} hours scheduled; ${weeklyMax} hours allowed.`,
    });
  }

  const startMinutes = minutesFromDayStart(shift.start, dateKey, options.timezone);
  const stopMinutes = minutesFromDayStart(shift.stop, dateKey, options.timezone);
  const latest = latestAllowedMinutes(band, dateKey, rules);

  if (startMinutes + 1e-6 < band.earliestStartMinutes) {
    warnings.push({
      code: "minor_too_early",
      message: `Minor may not start before ${clockFromMinutes(dateKey, band.earliestStartMinutes, options.timezone)}.`,
    });
  }

  if (stopMinutes > latest + 1e-6) {
    warnings.push({
      code: "minor_too_late",
      message: `Minor must finish by ${clockFromMinutes(dateKey, latest, options.timezone)}.`,
    });
  }

  return warnings;
}
