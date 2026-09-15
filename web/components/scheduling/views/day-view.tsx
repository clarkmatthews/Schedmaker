"use client";

import { format } from "date-fns";
import { hoursForDay, visibleRange, type HoursTemplateView } from "@/lib/scheduling/hours";
import { DAY_LANE_HEIGHT, DAY_ROW_PAD, laneLayout } from "@/lib/scheduling/lanes";
import {
  barStyle,
  formatSlot,
  slotFromClientX,
} from "@/lib/scheduling/time-grid";
import { ShiftCard } from "@/components/scheduling/shift-card";
import {
  SHIFT_DRAG_TYPE,
  type CalendarRow,
  type CalendarShift,
  type ViewBy,
} from "@/components/scheduling/types";
import { shiftDragGrabOffsetPx } from "@/lib/scheduling/shift-drag";
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

function hourBands(startSlot: number, endSlot: number) {
  const marks = hourMarks(startSlot, endSlot);
  const bands: { start: number; end: number }[] = [];
  if (marks.length === 0) {
    if (endSlot > startSlot) bands.push({ start: startSlot, end: endSlot });
    return bands;
  }
  if (marks[0]! > startSlot) {
    bands.push({ start: startSlot, end: marks[0]! });
  }
  for (let index = 0; index < marks.length; index += 1) {
    const start = marks[index]!;
    bands.push({ start, end: marks[index + 1] ?? endSlot });
  }
  return bands;
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

function trackElement(from: HTMLElement) {
  return from.closest("[data-day-track]") as HTMLElement | null;
}

function slotFromTrackPointer(
  event: { clientX: number },
  track: HTMLElement,
  startSlot: number,
  endSlot: number,
  grabOffsetPx = 0,
) {
  const rect = track.getBoundingClientRect();
  return slotFromClientX(
    event.clientX - grabOffsetPx,
    rect.left,
    rect.width,
    startSlot,
    endSlot,
  );
}

function dropGrabOffsetPx(event: React.DragEvent) {
  const stored = event.dataTransfer.getData("application/x-esp-shift-offset");
  const fromData = Number(stored);
  if (Number.isFinite(fromData) && stored !== "") return Math.max(0, fromData);
  return shiftDragGrabOffsetPx();
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
  copyLastTitle,
  onCopyLast,
}: {
  day: Date;
  rows: CalendarRow[];
  viewBy: ViewBy;
  timezone: string;
  hoursTemplate: HoursTemplateView | null;
  shiftsFor: (rowId: string, day: Date) => CalendarShift[];
  onCreate?: (day: Date, rowId: string, startSlot: number) => void;
  onOpen?: (shift: CalendarShift) => void;
  onPlace?: (shiftId: string, day: Date, rowId: string, copy: boolean, startSlot: number) => void;
  overtimeEnabled?: boolean;
  copyLastTitle?: string;
  onCopyLast?: () => void;
}) {
  const hours = hoursForDay(hoursTemplate, day, timezone);
  const range = visibleRange(hours);
  const marks = hourMarks(range.startSlot, range.endSlot);
  const bands = hourBands(range.startSlot, range.endSlot);
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
            <div className="flex w-36 shrink-0 items-center gap-1 px-2 py-2 text-sm font-medium">
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
                  data-day-track
                  className={`relative flex-1 ${closed ? "" : "cursor-pointer"}`}
                  style={{ ...background, height: layout.height }}
                  onDragOver={(event) => {
                    if (!onPlace) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                  }}
                  onDrop={(event) => {
                    if (!onPlace) return;
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
                        slotFromTrackPointer(
                          event,
                          event.currentTarget,
                          range.startSlot,
                          range.endSlot,
                          dropGrabOffsetPx(event),
                        ),
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
                  {closed
                    ? null
                    : bands.map((band) => (
                        <div
                          key={`band-${band.start}`}
                          className="group absolute inset-y-0 z-[1] hover:bg-teal/5"
                          style={{
                            left: `${((band.start - range.startSlot) / span) * 100}%`,
                            width: `${((band.end - band.start) / span) * 100}%`,
                          }}
                          onClick={(event) => {
                            if (!onCreate) return;
                            const track = trackElement(event.currentTarget);
                            if (!track) return;
                            onCreate(
                              day,
                              row.id,
                              slotFromTrackPointer(
                                event,
                                track,
                                range.startSlot,
                                range.endSlot,
                              ),
                            );
                          }}
                          onDragOver={(event) => {
                            if (!onPlace) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
                          }}
                          onDrop={(event) => {
                            if (!onPlace) return;
                            event.preventDefault();
                            event.stopPropagation();
                            const track = trackElement(event.currentTarget);
                            if (!track) return;
                            const shiftId =
                              event.dataTransfer.getData(SHIFT_DRAG_TYPE) ||
                              event.dataTransfer.getData("text/plain");
                            if (!shiftId) return;
                            onPlace(
                              shiftId,
                              day,
                              row.id,
                              event.altKey,
                              slotFromTrackPointer(
                                event,
                                track,
                                range.startSlot,
                                range.endSlot,
                                dropGrabOffsetPx(event),
                              ),
                            );
                          }}
                        >
                          {onCreate ? (
                            <div className="pointer-events-none hidden h-full items-center justify-center text-lg text-teal group-hover:flex">
                              +
                            </div>
                          ) : null}
                        </div>
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
                          canEdit={Boolean(onPlace)}
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
