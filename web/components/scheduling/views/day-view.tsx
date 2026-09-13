"use client";

import { format } from "date-fns";
import { hoursForDay, visibleRange, type HoursTemplateView } from "@/lib/scheduling/hours";
import { DAY_LANE_HEIGHT, DAY_ROW_PAD, laneLayout } from "@/lib/scheduling/lanes";
import {
  barStyle,
  formatSlot,
  slotFromPercent,
} from "@/lib/scheduling/time-grid";
import { ShiftCard } from "@/components/scheduling/shift-card";
import {
  SHIFT_DRAG_TYPE,
  type CalendarRow,
  type CalendarShift,
  type ViewBy,
} from "@/components/scheduling/types";
import {
  formatHours,
  formatHoursOt,
  onClockMsInRange,
  shiftOverlapsRange,
  slotInstant,
  uniqueEmployeeCount,
} from "@/lib/scheduling/totals";

function hourMarks(startSlot: number, endSlot: number) {
  const first = Math.ceil(startSlot / 4) * 4;
  const marks: number[] = [];
  for (let slot = first; slot < endSlot; slot += 4) {
    marks.push(slot);
  }
  return marks;
}

function trackBackground(
  startSlot: number,
  endSlot: number,
  businessStartSlot: number | null,
  businessEndSlot: number | null,
  hasTemplate: boolean,
) {
  if (!hasTemplate) return { backgroundColor: "#ffffff" };
  const span = Math.max(endSlot - startSlot, 1);
  if (businessStartSlot == null || businessEndSlot == null) {
    return { backgroundColor: "#c5ccd1" };
  }
  const left = ((businessStartSlot - startSlot) / span) * 100;
  const right = ((businessEndSlot - startSlot) / span) * 100;
  return {
    backgroundColor: "#c5ccd1",
    backgroundImage: `linear-gradient(to right, transparent ${left}%, #e8eaed ${left}%, #e8eaed ${right}%, transparent ${right}%)`,
  };
}

function slotFromEvent(
  event: React.MouseEvent | React.DragEvent,
  startSlot: number,
  endSlot: number,
) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const pct = (event.clientX - rect.left) / rect.width;
  return slotFromPercent(pct, startSlot, endSlot);
}

export function DayView({
  day,
  rows,
  viewBy,
  shiftsFor,
  timezone,
  hoursTemplate,
  onCreate,
  onOpen,
  onPlace,
  overtimeEnabled = false,
}: {
  day: Date;
  rows: CalendarRow[];
  viewBy: ViewBy;
  timezone: string;
  hoursTemplate: HoursTemplateView | null;
  shiftsFor: (rowId: string, day: Date) => CalendarShift[];
  onCreate: (day: Date, rowId: string, startSlot: number) => void;
  onOpen: (shift: CalendarShift) => void;
  onPlace: (shiftId: string, day: Date, rowId: string, copy: boolean, startSlot: number) => void;
  overtimeEnabled?: boolean;
}) {
  const hours = hoursForDay(hoursTemplate, day, timezone);
  const range = visibleRange(hours);
  const marks = hourMarks(range.startSlot, range.endSlot);
  const span = Math.max(range.endSlot - range.startSlot, 1);
  const closed = Boolean(hours?.closed);
  const hasTemplate = Boolean(hours && !hours.closed);
  const background = trackBackground(
    range.startSlot,
    range.endSlot,
    hasTemplate ? hours?.businessStartSlot ?? null : null,
    hasTemplate ? hours?.businessEndSlot ?? null : null,
    hasTemplate,
  );
  const allShifts = rows.flatMap((row) => shiftsFor(row.id, day));
  const hourTotals = marks.map((slot) => {
    const start = slotInstant(day, slot, timezone);
    const end = slotInstant(day, slot + 4, timezone);
    const overlapping = allShifts.filter((shift) => shiftOverlapsRange(shift, start, end));
    return {
      slot,
      ms: allShifts.reduce((sum, shift) => sum + onClockMsInRange(shift, start, end), 0),
      people: uniqueEmployeeCount(overlapping),
    };
  });
  const grandRegular = allShifts.reduce((sum, shift) => sum + (shift.regularMs ?? 0), 0);
  const grandOt = allShifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0);

  return (
    <div className="space-y-2">
      {closed ? (
        <p className="rounded-md border border-border bg-white px-3 py-2 text-sm text-muted">
          This location is closed on {format(day, "EEEE")}.
        </p>
      ) : null}
      <div className="overflow-auto rounded-lg border border-neutral-400 bg-white">
        <div className="min-w-[1400px]">
          <div className="sticky top-0 z-20 flex border-b border-neutral-400 bg-ink text-white">
            <div className="w-36 shrink-0 px-3 py-2 text-sm font-medium">
              {format(day, "EEE d")}
            </div>
            <div className="relative min-h-10 flex-1">
              {marks.map((slot) => (
                <div
                  key={slot}
                  className="absolute inset-y-0 flex items-center justify-center border-l border-white/25 text-center text-xs"
                  style={{
                    left: `${((slot - range.startSlot) / span) * 100}%`,
                    width: `${(4 / span) * 100}%`,
                  }}
                >
                  {formatSlot(slot)}
                </div>
              ))}
            </div>
            <div className="sticky right-0 z-30 w-24 shrink-0 border-l border-white/20 bg-ink px-2 py-2 text-right text-sm font-medium">
              {overtimeEnabled ? "Hours/OT" : "Hours"}
            </div>
          </div>
          {rows.map((row) => {
            const rowShifts = shiftsFor(row.id, day);
            const layout = laneLayout(rowShifts);
            return (
              <div
                key={`${viewBy}-${row.id}`}
                className="flex border-b border-neutral-400"
              >
                <div
                  className="flex w-36 shrink-0 items-center border-r border-neutral-400 px-2 text-sm font-medium"
                  style={{ minHeight: layout.height }}
                >
                  {row.label}
                </div>
                <div
                  className="relative flex-1 cursor-pointer hover:bg-teal/5"
                  style={{ ...background, height: layout.height }}
                  onClick={(event) => {
                    if (closed || event.target !== event.currentTarget) return;
                    onCreate(day, row.id, slotFromEvent(event, range.startSlot, range.endSlot));
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (closed) return;
                    const shiftId =
                      event.dataTransfer.getData(SHIFT_DRAG_TYPE) ||
                      event.dataTransfer.getData("text/plain");
                    if (shiftId) {
                      onPlace(
                        shiftId,
                        day,
                        row.id,
                        event.altKey,
                        slotFromEvent(event, range.startSlot, range.endSlot),
                      );
                    }
                  }}
                >
                  {marks.map((slot) => (
                    <div
                      key={`hour-${slot}`}
                      className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-neutral-500/70"
                      style={{ left: `${((slot - range.startSlot) / span) * 100}%` }}
                    />
                  ))}
                  {rowShifts.map((shift, index) => {
                    const style = barStyle(
                      new Date(shift.start),
                      new Date(shift.stop),
                      range.startSlot,
                      range.endSlot,
                    );
                    return (
                      <div
                        key={shift.id}
                        className="absolute z-[2]"
                        style={{
                          ...style,
                          top: DAY_ROW_PAD + layout.lanes[index] * DAY_LANE_HEIGHT,
                          height: DAY_LANE_HEIGHT - 2,
                        }}
                      >
                        <ShiftCard
                          shift={shift}
                          viewBy={viewBy}
                          color={row.color}
                          timezone={timezone}
                          compact
                          onOpen={onOpen}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="sticky right-0 z-10 flex w-24 shrink-0 items-center justify-end border-l border-neutral-400 bg-neutral-50 px-2 text-sm tabular-nums"
                  style={{ minHeight: layout.height }}
                >
                  {formatHoursOt(
                    rowShifts.reduce((sum, shift) => sum + (shift.regularMs ?? 0), 0),
                    rowShifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0),
                    overtimeEnabled,
                  )}
                </div>
              </div>
            );
          })}
          <div className="sticky bottom-0 z-20 flex border-t border-neutral-400 bg-neutral-100">
            <div className="flex w-36 shrink-0 items-center px-3 py-2 text-sm font-medium">
              Totals
            </div>
            <div className="relative min-h-12 flex-1">
              {hourTotals.map((item) => (
                <div
                  key={item.slot}
                  className="absolute top-0 flex h-full flex-col items-center justify-center border-l border-neutral-300 px-0.5 text-center text-[11px] leading-tight"
                  style={{
                    left: `${((item.slot - range.startSlot) / span) * 100}%`,
                    width: `${(4 / span) * 100}%`,
                  }}
                >
                  <div className="tabular-nums font-medium">{formatHours(item.ms)}h</div>
                  <div className="text-muted">{item.people}</div>
                </div>
              ))}
            </div>
            <div className="sticky right-0 z-30 flex w-24 shrink-0 items-center justify-end border-l border-neutral-400 bg-neutral-100 px-2 text-sm tabular-nums font-medium">
              {formatHoursOt(grandRegular, grandOt, overtimeEnabled)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
