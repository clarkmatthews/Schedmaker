"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";
import {
  bulkPublishShiftsAction,
  copyShiftAction,
  createShiftsAction,
  deleteShiftAction,
  placeShiftAction,
  updateShiftAction,
} from "@/lib/actions/shifts";
import { dateParam, stepDate, type CalendarView } from "@/lib/scheduling/views";
import { slotIndex } from "@/lib/scheduling/time-grid";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { TimezoneClock } from "@/components/scheduling/timezone-clock";
import {
  ShiftModal,
  breaksFromShift,
  type ShiftDraft,
} from "@/components/scheduling/shift-modal";
import { WeekView } from "@/components/scheduling/views/week-view";
import { DayView } from "@/components/scheduling/views/day-view";
import { LaborSummary } from "@/components/scheduling/labor-summary";
import type {
  CalendarJob,
  CalendarResponsibility,
  CalendarShift,
  CalendarWorker,
  ViewBy,
} from "@/components/scheduling/types";
import type { HoursTemplateView } from "@/lib/scheduling/hours";

export function CalendarShell({
  companyId,
  teamId,
  view,
  dateIso,
  weekStartIso,
  rangeStartIso,
  rangeEndIso,
  timezone,
  shifts,
  workers,
  jobs,
  responsibilities,
  hoursTemplate,
  overtimeEnabled = false,
  responsibilitiesEnabled = true,
  hourlyRates = {},
}: {
  companyId: string;
  teamId: string;
  view: CalendarView;
  dateIso: string;
  weekStartIso: string;
  rangeStartIso: string;
  rangeEndIso: string;
  timezone: string;
  shifts: CalendarShift[];
  workers: CalendarWorker[];
  jobs: CalendarJob[];
  responsibilities: CalendarResponsibility[];
  hoursTemplate: HoursTemplateView | null;
  overtimeEnabled?: boolean;
  responsibilitiesEnabled?: boolean;
  hourlyRates?: Record<string, number>;
}) {
  const router = useRouter();
  const date = parseISO(dateIso);
  const weekStart = parseISO(weekStartIso);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [viewBy, setViewBy] = useState<ViewBy>("employee");
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allPublished = shifts.length > 0 && shifts.every((s) => s.published);

  const rows = useMemo(() => {
    if (viewBy === "employee") {
      return [
        { id: "", label: "Unassigned", color: "5B5B5B" },
        ...workers.map((w) => ({ id: w.id, label: w.name, color: "48B7AB" })),
      ];
    }
    return [
      { id: "", label: "No job", color: "5B5B5B" },
      ...jobs.map((j) => ({ id: j.id, label: j.name, color: j.color })),
    ];
  }, [viewBy, workers, jobs]);

  function shiftsFor(rowId: string, day: Date) {
    return shifts.filter((shift) => {
      const start = parseISO(shift.start);
      const sameDay =
        formatInTimeZone(start, timezone, "yyyy-MM-dd") ===
        formatInTimeZone(day, timezone, "yyyy-MM-dd");
      const match =
        viewBy === "employee"
          ? (shift.userId ?? "") === rowId
          : (shift.jobId ?? "") === rowId;
      return sameDay && match;
    });
  }

  function goTo(nextView: CalendarView, nextDate: Date) {
    router.push(`?view=${nextView}&date=${dateParam(nextDate)}`);
  }

  function assignment(rowId: string) {
    return {
      userId: viewBy === "employee" ? rowId : "",
      jobId: viewBy === "job" ? rowId : "",
    };
  }

  function openCreate(day: Date, rowId: string, startSlot = 36) {
    const stopSlot = Math.min(startSlot + 32, 95);
    setDraft({
      days: [format(day, "yyyy-MM-dd")],
      startSlot,
      stopSlot: stopSlot <= startSlot ? 95 : stopSlot,
      published: false,
      breaks: [],
      responsibilityIds: [],
      ...assignment(rowId),
    });
    setError(null);
  }

  function openEdit(shift: CalendarShift) {
    setDraft({
      shiftId: shift.id,
      days: [format(parseISO(shift.start), "yyyy-MM-dd")],
      startSlot: slotIndex(parseISO(shift.start)),
      stopSlot: slotIndex(parseISO(shift.stop)),
      userId: shift.userId ?? "",
      jobId: shift.jobId ?? "",
      published: shift.published,
      breaks: breaksFromShift(shift.start, shift.breaks),
      responsibilityIds: shift.responsibilityIds,
    });
    setError(null);
  }

  function draftForm(next: ShiftDraft) {
    const formData = new FormData();
    formData.set("days", JSON.stringify(next.days));
    formData.set("day", next.days[0] ?? dateParam(date));
    formData.set("startSlot", String(next.startSlot));
    formData.set("stopSlot", String(next.stopSlot));
    formData.set("userId", next.userId);
    formData.set("jobId", next.jobId);
    formData.set("published", next.published ? "true" : "false");
    formData.set("breaks", JSON.stringify(next.breaks));
    formData.set("responsibilityIds", JSON.stringify(next.responsibilityIds));
    return formData;
  }

  async function saveDraft() {
    if (!draft) return;
    const formData = draftForm(draft);
    const result = draft.shiftId
      ? await updateShiftAction(companyId, teamId, draft.shiftId, formData)
      : await createShiftsAction(companyId, teamId, formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function copyDraft() {
    if (!draft?.shiftId) return;
    const formData = draftForm(draft);
    const result = await copyShiftAction(companyId, teamId, draft.shiftId, formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function place(
    shiftId: string,
    day: Date,
    rowId: string,
    copy: boolean,
    startSlot?: number,
  ) {
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift) return;
    const start = parseISO(shift.start);
    const stop = parseISO(shift.stop);
    const durationMs = stop.getTime() - start.getTime();
    const nextStart =
      startSlot == null
        ? new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            start.getHours(),
            start.getMinutes(),
          )
        : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    if (startSlot != null) {
      nextStart.setHours(0, 0, 0, 0);
      nextStart.setMinutes(startSlot * 15);
    }
    const nextStop = new Date(nextStart.getTime() + durationMs);
    const formData = new FormData();
    formData.set("start", nextStart.toISOString());
    formData.set("stop", nextStop.toISOString());
    formData.set("userId", viewBy === "employee" ? rowId : shift.userId || "");
    formData.set("jobId", viewBy === "job" ? rowId : shift.jobId || "");
    formData.set("copy", copy ? "true" : "false");
    const result = await placeShiftAction(companyId, teamId, shiftId, formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  const label =
    view === "day"
      ? format(date, "EEEE, MMM d, yyyy")
      : `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="w-24"
            onClick={() => goTo(view, stepDate(view, date, -1))}
          >
            Previous
          </Button>
          <h1 className="min-w-48 text-center text-lg font-semibold">{label}</h1>
          <Button
            variant="outline"
            className="w-24"
            onClick={() => goTo(view, stepDate(view, date, 1))}
          >
            Next
          </Button>
          <TimezoneClock timezone={timezone} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-md border border-border bg-white p-0.5">
            <Button
              variant={view === "week" ? "primary" : "ghost"}
              className="w-full px-3 py-1.5"
              onClick={() => goTo("week", date)}
            >
              Week
            </Button>
            <Button
              variant={view === "day" ? "primary" : "ghost"}
              className="w-full px-3 py-1.5"
              onClick={() => goTo("day", date)}
            >
              Day
            </Button>
          </div>
          <Select
            value={viewBy}
            onChange={(event) => setViewBy(event.target.value as ViewBy)}
            className="w-40"
          >
            <option value="employee">View by employee</option>
            <option value="job">View by job</option>
          </Select>
          <Button
            variant={allPublished ? "outline" : "primary"}
            onClick={async () => {
              await bulkPublishShiftsAction(
                companyId,
                teamId,
                !allPublished,
                rangeStartIso,
                rangeEndIso,
              );
              router.refresh();
            }}
          >
            {allPublished
              ? view === "day"
                ? "Unpublish day"
                : "Unpublish week"
              : view === "day"
                ? "Publish day"
                : "Publish week"}
          </Button>
        </div>
      </div>

      {error && !draft ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {view === "day" ? (
        <DayView
          day={date}
          rows={rows}
          viewBy={viewBy}
          timezone={timezone}
          shiftsFor={shiftsFor}
          onCreate={openCreate}
          onOpen={openEdit}
          onPlace={place}
          hoursTemplate={hoursTemplate}
          overtimeEnabled={overtimeEnabled}
        />
      ) : (
        <WeekView
          days={weekDays}
          rows={rows}
          viewBy={viewBy}
          timezone={timezone}
          shiftsFor={shiftsFor}
          onCreate={openCreate}
          onOpen={openEdit}
          onPlace={place}
          onSelectDay={(day) => goTo("day", day)}
          overtimeEnabled={overtimeEnabled}
        />
      )}

      <LaborSummary
        shifts={shifts}
        overtimeEnabled={overtimeEnabled}
        hourlyRates={hourlyRates}
      />

      {draft ? (
        <ShiftModal
          draft={draft}
          weekDays={weekDays}
          workers={workers}
          jobs={jobs}
          responsibilities={responsibilities}
          responsibilitiesEnabled={responsibilitiesEnabled}
          error={error}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          onCopy={copyDraft}
          onDelete={
            draft.shiftId
              ? async () => {
                  await deleteShiftAction(companyId, teamId, draft.shiftId!);
                  setDraft(null);
                  router.refresh();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
