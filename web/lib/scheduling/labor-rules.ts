import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { onClockMs } from "@/lib/scheduling/totals";

export const US_STATES = [
  { code: "", name: "Not set" },
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export type MealRules = {
  enabled: boolean;
  firstAfterHours: number;
  firstMinutes: number;
  firstStartByHours: number;
  firstWaiverMaxHours: number;
  secondAfterHours: number;
  secondMinutes: number;
  secondStartByHours: number;
  secondWaiverMaxHours: number;
};

export type ShiftWarning = {
  code: string;
  message: string;
};

export const CA_MEAL_RULES: MealRules = {
  enabled: true,
  firstAfterHours: 5,
  firstMinutes: 30,
  firstStartByHours: 5,
  firstWaiverMaxHours: 6,
  secondAfterHours: 10,
  secondMinutes: 30,
  secondStartByHours: 10,
  secondWaiverMaxHours: 12,
};

export type OvertimeRules = {
  enabled: boolean;
  dailyAfterHours: number;
  dailyDoubleAfterHours: number;
  weeklyAfterHours: number;
  seventhDayEnabled: boolean;
  seventhDayDoubleAfterHours: number;
};

export const CA_OVERTIME_RULES: OvertimeRules = {
  enabled: true,
  dailyAfterHours: 8,
  dailyDoubleAfterHours: 12,
  weeklyAfterHours: 40,
  seventhDayEnabled: true,
  seventhDayDoubleAfterHours: 8,
};

export function mealRulesForState(state: string): MealRules {
  if (state === "CA") return { ...CA_MEAL_RULES };
  return { ...CA_MEAL_RULES, enabled: false };
}

export function overtimeRulesForState(state: string): OvertimeRules {
  if (state === "CA") return { ...CA_OVERTIME_RULES };
  return { ...CA_OVERTIME_RULES, enabled: false };
}

export type OvertimeSplit = {
  regularMs: number;
  otMs: number;
};

function asNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOvertimeRules(value: unknown): OvertimeRules | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    enabled: Boolean(raw.enabled),
    dailyAfterHours: asNumber(raw.dailyAfterHours, CA_OVERTIME_RULES.dailyAfterHours),
    dailyDoubleAfterHours: asNumber(
      raw.dailyDoubleAfterHours,
      CA_OVERTIME_RULES.dailyDoubleAfterHours,
    ),
    weeklyAfterHours: asNumber(raw.weeklyAfterHours, CA_OVERTIME_RULES.weeklyAfterHours),
    seventhDayEnabled: raw.seventhDayEnabled !== false,
    seventhDayDoubleAfterHours: asNumber(
      raw.seventhDayDoubleAfterHours,
      CA_OVERTIME_RULES.seventhDayDoubleAfterHours,
    ),
  };
}

export function parseMealRules(value: unknown): MealRules | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    enabled: Boolean(raw.enabled),
    firstAfterHours: asNumber(raw.firstAfterHours, CA_MEAL_RULES.firstAfterHours),
    firstMinutes: asNumber(raw.firstMinutes, CA_MEAL_RULES.firstMinutes),
    firstStartByHours: asNumber(raw.firstStartByHours, CA_MEAL_RULES.firstStartByHours),
    firstWaiverMaxHours: asNumber(raw.firstWaiverMaxHours, CA_MEAL_RULES.firstWaiverMaxHours),
    secondAfterHours: asNumber(raw.secondAfterHours, CA_MEAL_RULES.secondAfterHours),
    secondMinutes: asNumber(raw.secondMinutes, CA_MEAL_RULES.secondMinutes),
    secondStartByHours: asNumber(raw.secondStartByHours, CA_MEAL_RULES.secondStartByHours),
    secondWaiverMaxHours: asNumber(
      raw.secondWaiverMaxHours,
      CA_MEAL_RULES.secondWaiverMaxHours,
    ),
  };
}

function hoursBetween(start: Date, stop: Date) {
  return Math.max(0, (stop.getTime() - start.getTime()) / 3_600_000);
}

function clock(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "h:mm a");
}

export function evaluateMealWarnings(
  shift: { start: string; stop: string; breaks: { start: string; stop: string }[] },
  rules: MealRules | null,
  options: { waivedFirst?: boolean; timezone: string },
): ShiftWarning[] {
  if (!rules?.enabled) return [];

  const start = parseISO(shift.start);
  const stop = parseISO(shift.stop);
  const spanHours = hoursBetween(start, stop);
  const minMealMinutes = Math.min(rules.firstMinutes, rules.secondMinutes);
  const meals = shift.breaks
    .map((item) => ({
      start: parseISO(item.start),
      stop: parseISO(item.stop),
      minutes: hoursBetween(parseISO(item.start), parseISO(item.stop)) * 60,
    }))
    .filter((item) => item.minutes + 0.01 >= minMealMinutes)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const warnings: ShiftWarning[] = [];
  const firstDeadline = new Date(start.getTime() + rules.firstStartByHours * 3_600_000);
  const secondDeadline = new Date(start.getTime() + rules.secondStartByHours * 3_600_000);
  const firstWaived =
    Boolean(options.waivedFirst) && spanHours <= rules.firstWaiverMaxHours + 1e-6;

  if (spanHours > rules.firstAfterHours && !firstWaived) {
    const first = meals[0];
    if (!first) {
      warnings.push({
        code: "first_meal_missing",
        message: `Meal break required: ${rules.firstMinutes} minutes must start by ${clock(firstDeadline, options.timezone)}.`,
      });
    } else if (first.start.getTime() > firstDeadline.getTime() + 1000) {
      warnings.push({
        code: "first_meal_late",
        message: `Meal break starts too late: must start by ${clock(firstDeadline, options.timezone)}.`,
      });
    } else if (first.minutes + 0.01 < rules.firstMinutes) {
      warnings.push({
        code: "first_meal_short",
        message: `Meal break is ${Math.round(first.minutes)} minutes; ${rules.firstMinutes} minutes required.`,
      });
    }
  }

  if (spanHours > rules.secondAfterHours) {
    const second = meals[1];
    if (!second) {
      warnings.push({
        code: "second_meal_missing",
        message: `Second meal break required: ${rules.secondMinutes} minutes must start by ${clock(secondDeadline, options.timezone)}.`,
      });
    } else if (second.start.getTime() > secondDeadline.getTime() + 1000) {
      warnings.push({
        code: "second_meal_late",
        message: `Second meal break starts too late: must start by ${clock(secondDeadline, options.timezone)}.`,
      });
    } else if (second.minutes + 0.01 < rules.secondMinutes) {
      warnings.push({
        code: "second_meal_short",
        message: `Second meal break is ${Math.round(second.minutes)} minutes; ${rules.secondMinutes} minutes required.`,
      });
    }
  }

  return warnings;
}

function dayKey(start: string, timezone: string) {
  return formatInTimeZone(parseISO(start), timezone, "yyyy-MM-dd");
}

function splitShift(onClock: number, otMs: number): OvertimeSplit {
  const ot = Math.min(onClock, Math.max(0, otMs));
  return { regularMs: Math.max(0, onClock - ot), otMs: ot };
}

export function allocateOvertime(
  shifts: Array<{
    id: string;
    start: string;
    stop: string;
    userId?: string | null;
    breaks: { start: string; stop: string }[];
  }>,
  rules: OvertimeRules | null,
  timezone: string,
): Map<string, OvertimeSplit> {
  const result = new Map<string, OvertimeSplit>();
  if (!rules?.enabled) {
    for (const shift of shifts) {
      result.set(shift.id, { regularMs: onClockMs(shift), otMs: 0 });
    }
    return result;
  }

  const dailyAfterMs = rules.dailyAfterHours * 3_600_000;
  const weeklyAfterMs = rules.weeklyAfterHours * 3_600_000;
  const byUser = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    if (!shift.userId) {
      const hours = onClockMs(shift);
      result.set(shift.id, splitShift(hours, Math.max(0, hours - dailyAfterMs)));
      continue;
    }
    const list = byUser.get(shift.userId) ?? [];
    list.push(shift);
    byUser.set(shift.userId, list);
  }

  for (const userShifts of byUser.values()) {
    const byDay = new Map<string, typeof userShifts>();
    for (const shift of userShifts) {
      const key = dayKey(shift.start, timezone);
      const list = byDay.get(key) ?? [];
      list.push(shift);
      byDay.set(key, list);
    }
    const days = [...byDay.keys()].sort();
    const dayHours = new Map<string, number>();
    for (const day of days) {
      const hours = (byDay.get(day) ?? []).reduce((sum, shift) => sum + onClockMs(shift), 0);
      dayHours.set(day, hours);
    }
    const worked = days.filter((day) => (dayHours.get(day) ?? 0) > 0);
    const seventhDay = rules.seventhDayEnabled && worked.length >= 7 ? worked[6] : null;
    const dailyOt = new Map<string, number>();
    let weekHours = 0;
    let dailyOtTotal = 0;
    for (const day of days) {
      const hours = dayHours.get(day) ?? 0;
      weekHours += hours;
      const ot = day === seventhDay ? hours : Math.max(0, hours - dailyAfterMs);
      dailyOt.set(day, ot);
      dailyOtTotal += ot;
    }
    let extraWeekly = Math.max(0, Math.max(0, weekHours - weeklyAfterMs) - dailyOtTotal);
    const remainingRegular = new Map<string, number>();
    for (const day of days) {
      remainingRegular.set(day, (dayHours.get(day) ?? 0) - (dailyOt.get(day) ?? 0));
    }
    for (const day of [...days].reverse()) {
      if (extraWeekly <= 0) break;
      const available = remainingRegular.get(day) ?? 0;
      const take = Math.min(available, extraWeekly);
      dailyOt.set(day, (dailyOt.get(day) ?? 0) + take);
      remainingRegular.set(day, available - take);
      extraWeekly -= take;
    }
    for (const day of days) {
      const hours = dayHours.get(day) ?? 0;
      const ot = dailyOt.get(day) ?? 0;
      for (const shift of byDay.get(day) ?? []) {
        const shiftHours = onClockMs(shift);
        const share = hours > 0 ? shiftHours / hours : 0;
        result.set(shift.id, splitShift(shiftHours, ot * share));
      }
    }
  }

  return result;
}

export function sumOvertimeSplit(shifts: Array<OvertimeSplit & { start: string; stop: string; breaks: { start: string; stop: string }[] }>) {
  return shifts.reduce(
    (sum, shift) => ({
      regularMs: sum.regularMs + (shift.regularMs ?? onClockMs(shift)),
      otMs: sum.otMs + (shift.otMs ?? 0),
    }),
    { regularMs: 0, otMs: 0 },
  );
}
