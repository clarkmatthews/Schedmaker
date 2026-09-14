import { Fragment } from "react";
import { addDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export type PrintWeekShift = {
  userId: string;
  userName: string;
  start: string;
  stop: string;
  breakStarts: string[];
};

type DayCell = {
  start: string;
  stop: string;
  breakStarts: string[];
} | null;

type EmployeeSlots = {
  id: string;
  name: string;
  slots: { days: DayCell[] }[];
};

function dayKey(iso: string, timezone: string) {
  return formatInTimeZone(parseISO(iso), timezone, "yyyy-MM-dd");
}

function clock(iso: string, timezone: string) {
  return formatInTimeZone(parseISO(iso), timezone, "h:mm a");
}

export function buildPrintEmployees(
  shifts: PrintWeekShift[],
  weekDays: Date[],
  timezone: string,
): EmployeeSlots[] {
  const weekKeys = weekDays.map((day) => formatInTimeZone(day, timezone, "yyyy-MM-dd"));
  const byUser = new Map<string, { name: string; shifts: PrintWeekShift[] }>();

  for (const shift of shifts) {
    const existing = byUser.get(shift.userId);
    if (existing) {
      existing.shifts.push(shift);
    } else {
      byUser.set(shift.userId, { name: shift.userName, shifts: [shift] });
    }
  }

  return [...byUser.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name, undefined, { sensitivity: "base" }))
    .map(([id, { name, shifts: userShifts }]) => {
      const byDay = new Map<string, PrintWeekShift[]>();
      for (const shift of userShifts) {
        const key = dayKey(shift.start, timezone);
        const list = byDay.get(key) ?? [];
        list.push(shift);
        byDay.set(key, list);
      }
      for (const list of byDay.values()) {
        list.sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());
      }
      const maxSlots = Math.max(1, ...[...byDay.values()].map((list) => list.length));
      const slots = Array.from({ length: maxSlots }, (_, slot) => ({
        days: weekKeys.map((key) => {
          const shift = byDay.get(key)?.[slot];
          if (!shift) return null;
          return {
            start: clock(shift.start, timezone),
            stop: clock(shift.stop, timezone),
            breakStarts: [...shift.breakStarts]
              .sort((a, b) => parseISO(a).getTime() - parseISO(b).getTime())
              .map((iso) => clock(iso, timezone)),
          };
        }),
      }));
      return { id, name, slots };
    });
}

export function PrintWeek({
  teamName,
  timezone,
  weekStartIso,
  employees,
}: {
  teamName: string;
  timezone: string;
  weekStartIso: string;
  employees: EmployeeSlots[];
}) {
  const weekStart = parseISO(weekStartIso);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = weekDays[6]!;
  const rangeLabel = `${formatInTimeZone(weekStart, timezone, "EEE, MMM d")} – ${formatInTimeZone(weekEnd, timezone, "EEE, MMM d, yyyy")}`;

  return (
    <div className="print-week-sheet space-y-4 text-ink">
      <div>
        <h1 className="text-xl font-bold">{teamName}</h1>
        <p className="text-sm text-muted">{rangeLabel}</p>
      </div>
      {employees.length === 0 ? (
        <p className="text-sm text-muted">No assigned shifts this week.</p>
      ) : (
        <table className="print-week-table w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="print-week-label" />
              <th className="print-week-label" />
              {weekDays.map((day) => (
                <th key={day.toISOString()} className="print-week-day">
                  <div>{formatInTimeZone(day, timezone, "EEEE")}</div>
                  <div className="font-normal">{formatInTimeZone(day, timezone, "M/d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) =>
              employee.slots.map((slot, slotIndex) => {
                const breakCount = Math.max(
                  0,
                  ...slot.days.map((cell) => cell?.breakStarts.length ?? 0),
                );
                return (
                  <Fragment key={`${employee.id}-${slotIndex}`}>
                    <tr>
                      <th className="print-week-name">{employee.name}</th>
                      <th className="print-week-row">Time In</th>
                      {slot.days.map((cell, dayIndex) => (
                        <td key={`${employee.id}-${slotIndex}-in-${dayIndex}`}>{cell?.start ?? ""}</td>
                      ))}
                    </tr>
                    <tr>
                      <th className="print-week-name" />
                      <th className="print-week-row">Time Out</th>
                      {slot.days.map((cell, dayIndex) => (
                        <td key={`${employee.id}-${slotIndex}-out-${dayIndex}`}>{cell?.stop ?? ""}</td>
                      ))}
                    </tr>
                    {Array.from({ length: breakCount }, (_, breakIndex) => (
                      <tr key={`${employee.id}-${slotIndex}-break-${breakIndex}`}>
                        <th className="print-week-name" />
                        <th className="print-week-row">Break</th>
                        {slot.days.map((cell, dayIndex) => (
                          <td key={`${employee.id}-${slotIndex}-break-${breakIndex}-${dayIndex}`}>
                            {cell?.breakStarts[breakIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              }),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
