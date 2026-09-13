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

export function WeekView({
  days,
  rows,
  viewBy,
  shiftsFor,
  timezone,
  onCreate,
  onOpen,
  onPlace,
  overtimeEnabled = false,
}: {
  days: Date[];
  rows: CalendarRow[];
  viewBy: ViewBy;
  timezone: string;
  shiftsFor: (rowId: string, day: Date) => CalendarShift[];
  onCreate: (day: Date, rowId: string) => void;
  onOpen: (shift: CalendarShift) => void;
  onPlace: (shiftId: string, day: Date, rowId: string, copy: boolean) => void;
  overtimeEnabled?: boolean;
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
            <th className="sticky left-0 z-20 bg-ink px-3 py-2 text-left"> </th>
            {days.map((day) => (
              <th key={day.toISOString()} className="px-3 py-2 font-medium">
                {format(day, "EEE d")}
              </th>
            ))}
            <th className="sticky right-0 z-20 min-w-24 border-l border-white/20 bg-ink px-3 py-2 text-right font-medium">
              {overtimeEnabled ? "Hours/OT" : "Hours"}
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
                  {row.label}
                </td>
                {days.map((day) => {
                  const cellShifts = shiftsFor(row.id, day);
                  return (
                    <td
                      key={day.toISOString()}
                      className="group min-w-36 border-l border-border p-1 hover:bg-teal/5"
                      onClick={() => onCreate(day, row.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                      }}
                      onDrop={(event) => {
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
                            onOpen={onOpen}
                          />
                        ))}
                        <div className="pointer-events-none hidden h-6 items-center justify-center text-lg text-teal group-hover:flex">
                          +
                        </div>
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
