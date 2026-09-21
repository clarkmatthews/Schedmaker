"use client";

import { format } from "date-fns";
import { ShiftCard } from "@/components/scheduling/shift-card";
import {
  SHIFT_DRAG_TYPE,
  type CalendarRow,
  type CalendarShift,
  type ViewBy,
} from "@/components/scheduling/types";
import { formatHoursOt, uniqueEmployeeCount } from "@/lib/scheduling/totals";
import { HelpTip } from "@/components/ui/help-tip";

export function WeekView({
  days,
  rows,
  viewBy,
  shiftsFor,
  timezone,
  onCreate,
  onOpen,
  onPlace,
  onSelectDay,
  overtimeEnabled = false,
  copyLastTitle,
  onCopyLast,
}: {
  days: Date[];
  rows: CalendarRow[];
  viewBy: ViewBy;
  timezone: string;
  shiftsFor: (rowId: string, day: Date) => CalendarShift[];
  onCreate?: (day: Date, rowId: string) => void;
  onOpen?: (shift: CalendarShift) => void;
  onPlace?: (shiftId: string, day: Date, rowId: string, copy: boolean) => void;
  onSelectDay: (day: Date) => void;
  overtimeEnabled?: boolean;
  copyLastTitle?: string;
  onCopyLast?: () => void;
}) {
  const dayTotals = days.map((day) => {
    const shifts = rows.flatMap((row) => shiftsFor(row.id, day));
    return {
      day,
      regularMs: shifts.reduce((sum, shift) => sum + (shift.regularMs ?? 0), 0),
      otMs: shifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0),
      people: uniqueEmployeeCount(shifts),
    };
  });
  const grandRegular = dayTotals.reduce((sum, item) => sum + item.regularMs, 0);
  const grandOt = dayTotals.reduce((sum, item) => sum + item.otMs, 0);

  return (
    <div className="overflow-auto rounded-lg border border-border bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ink text-white">
            <th className="sticky left-0 z-20 bg-ink px-2 py-2 text-left">
              {onCopyLast ? (
                <button
                  type="button"
                  title={copyLastTitle}
                  aria-label={copyLastTitle}
                  className="rounded p-1 text-white hover:bg-white/10"
                  onClick={onCopyLast}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="13" height="13" x="9" y="9" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              ) : null}
              {onCopyLast ? <HelpTip topic="copyLastWeek" tone="onDark" /> : null}
            </th>
            {days.map((day) => (
              <th key={day.toISOString()} className="px-1 py-1 font-medium">
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 hover:bg-white/10"
                  aria-label={`Open ${format(day, "EEEE, MMM d")} in day view`}
                  onClick={() => onSelectDay(day)}
                >
                  {format(day, "EEE d")}
                </button>
              </th>
            ))}
            <th className="sticky right-0 z-20 min-w-24 border-l border-white/20 bg-ink px-3 py-2 text-right font-medium">
              <span className="inline-flex items-center justify-end gap-1">
                {overtimeEnabled ? "Hours/OT" : "Hours"}
                <HelpTip topic="hoursOt" tone="onDark" align="end" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowShifts = days.flatMap((day) => shiftsFor(row.id, day));
            const rowRegular = rowShifts.reduce((sum, shift) => sum + (shift.regularMs ?? 0), 0);
            const rowOt = rowShifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0);
            return (
              <tr key={`${viewBy}-${row.id}`} className="border-t border-border align-top">
                <td className="sticky left-0 z-10 min-w-36 bg-white px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {viewBy === "employee" && row.id === "" ? (
                      <HelpTip topic="unassigned" />
                    ) : null}
                  </span>
                </td>
                {days.map((day) => {
                  const cellShifts = shiftsFor(row.id, day);
                  return (
                    <td
                      key={day.toISOString()}
                      className="group min-w-36 border-l border-border p-1 hover:bg-teal/5"
                      onClick={() => onCreate?.(day, row.id)}
                      onDragOver={(event) => {
                        if (!onPlace) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                      }}
                      onDrop={(event) => {
                        if (!onPlace) return;
                        event.preventDefault();
                        const shiftId =
                          event.dataTransfer.getData(SHIFT_DRAG_TYPE) ||
                          event.dataTransfer.getData("text/plain");
                        if (shiftId) {
                          onPlace(shiftId, day, row.id, event.altKey);
                        }
                      }}
                    >
                      <div className="space-y-1">
                        {cellShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            viewBy={viewBy}
                            color={row.color}
                            timezone={timezone}
                            canEdit={Boolean(onPlace)}
                            onOpen={onOpen}
                          />
                        ))}
                        {onCreate ? (
                          <div className="pointer-events-none hidden h-6 items-center justify-center text-lg text-teal group-hover:flex">
                            +
                          </div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 border-l border-border bg-neutral-50 px-3 py-2 text-right tabular-nums">
                  {formatHoursOt(rowRegular, rowOt, overtimeEnabled)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 z-20 border-t border-border bg-neutral-100">
            <td className="sticky left-0 z-30 bg-neutral-100 px-3 py-2 font-medium">Totals</td>
            {dayTotals.map((item) => (
              <td
                key={item.day.toISOString()}
                className="border-l border-border px-3 py-2 text-center text-xs leading-tight"
              >
                <div className="tabular-nums font-medium">
                  {formatHoursOt(item.regularMs, item.otMs, overtimeEnabled)}
                </div>
                <div className="text-muted">{item.people}</div>
              </td>
            ))}
            <td className="sticky right-0 z-30 border-l border-border bg-neutral-100 px-3 py-2 text-right tabular-nums font-medium">
              {formatHoursOt(grandRegular, grandOt, overtimeEnabled)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
