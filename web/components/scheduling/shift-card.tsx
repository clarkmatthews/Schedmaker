"use client";

import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { SHIFT_DRAG_TYPE, type CalendarShift, type ViewBy } from "@/components/scheduling/types";

function BreakOverlay({ shift }: { shift: CalendarShift }) {
  const start = parseISO(shift.start).getTime();
  const duration = parseISO(shift.stop).getTime() - start;
  if (duration <= 0 || shift.breaks.length === 0) return null;

  return (
    <>
      {shift.breaks.map((item) => {
        const left = ((parseISO(item.start).getTime() - start) / duration) * 100;
        const width = ((parseISO(item.stop).getTime() - parseISO(item.start).getTime()) / duration) * 100;
        return (
          <span
            key={item.id}
            className="break-hatch pointer-events-none absolute top-0 h-full"
            style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
          />
        );
      })}
    </>
  );
}

export function ShiftCard({
  shift,
  viewBy,
  color,
  timezone,
  compact = false,
  onOpen,
}: {
  shift: CalendarShift;
  viewBy: ViewBy;
  color: string;
  timezone: string;
  compact?: boolean;
  onOpen: (shift: CalendarShift) => void;
}) {
  return (
    <button
      type="button"
      draggable
      className={cn(
        "relative block h-full w-full rounded px-2 text-left text-xs text-white",
        compact ? "py-0.5" : "py-1",
        shift.published
          ? "border border-transparent"
          : "border border-dashed border-white/80 opacity-80",
      )}
      style={{ backgroundColor: `#${shift.jobColor ?? color}` }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(shift);
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData(SHIFT_DRAG_TYPE, shift.id);
        event.dataTransfer.setData("text/plain", shift.id);
        event.dataTransfer.effectAllowed = "copyMove";
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded">
        <BreakOverlay shift={shift} />
      </div>
      <div
        className={cn(
          "relative",
          compact && "flex h-full items-center justify-between gap-2",
        )}
      >
        <div className={cn("font-semibold", compact && "flex min-w-0 shrink-0 items-center gap-1")}>
          {shift.warnings?.length ? (
            <span
              className="group/warn relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white"
              title={shift.warnings.map((item) => item.message).join("\n")}
            >
              !
              <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1 hidden w-56 rounded bg-ink px-2 py-1 text-left text-[11px] font-normal normal-case leading-snug text-white shadow-lg group-hover/warn:block">
                {shift.warnings.map((item) => (
                  <span key={item.code} className="block">
                    {item.message}
                  </span>
                ))}
              </span>
            </span>
          ) : null}
          {formatInTimeZone(parseISO(shift.start), timezone, "h:mm a")}–
          {formatInTimeZone(parseISO(shift.stop), timezone, "h:mm a")}
          {shift.published ? null : compact ? (
            <span className="ml-1 uppercase">Draft</span>
          ) : null}
        </div>
        {compact ? (
          <div className="min-w-0 truncate text-right">
            {shift.jobName || "No job"}
          </div>
        ) : (
          <div>
            {viewBy === "employee" ? shift.jobName || "No job" : shift.userName || "Unassigned"}
          </div>
        )}
        {shift.published || compact ? null : (
          <div className="font-semibold uppercase">Draft</div>
        )}
      </div>
    </button>
  );
}
