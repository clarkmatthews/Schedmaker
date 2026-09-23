"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Label, Select } from "@/components/ui/input";
import { BreakOffsetSelect, TimeSelect } from "@/components/scheduling/time-select";
import type { BreakInput } from "@/lib/actions/shifts";
import { breaksOverlap, defaultBreakPlacement } from "@/lib/scheduling/break-rules";
import { END_SLOT, MAX_BREAK_SLOTS, SLOT_MINUTES, formatSlot } from "@/lib/scheduling/time-grid";
import { formatHours } from "@/lib/scheduling/totals";
import {
  clampSlotsToWindow,
  hoursForDateKey,
  scheduleWindowForDateKeys,
  type HoursTemplateView,
} from "@/lib/scheduling/hours";
import type { CalendarJob, CalendarResponsibility, CalendarWorker } from "@/components/scheduling/types";

export type ShiftDraft = {
  shiftId?: string;
  days: string[];
  startSlot: number;
  stopSlot: number;
  userId: string;
  jobId: string;
  published: boolean;
  breaks: BreakInput[];
  responsibilityIds: string[];
};

export function ShiftModal({
  draft,
  weekDays,
  workers,
  jobs,
  responsibilities,
  responsibilitiesEnabled = true,
  hoursTemplate = null,
  error,
  onChange,
  onClose,
  onSave,
  onCopy,
  onDelete,
}: {
  draft: ShiftDraft;
  weekDays: Date[];
  workers: CalendarWorker[];
  jobs: CalendarJob[];
  responsibilities: CalendarResponsibility[];
  responsibilitiesEnabled?: boolean;
  hoursTemplate?: HoursTemplateView | null;
  error: string | null;
  onChange: (draft: ShiftDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const hoursWindow = scheduleWindowForDateKeys(hoursTemplate, draft.days);
  const hoursConfigured = Boolean(hoursTemplate);
  const closedLabels = weekDays
    .filter((day) => hoursWindow?.closedDateKeys.includes(format(day, "yyyy-MM-dd")))
    .map((day) => format(day, "EEE"));
  const hoursValid =
    !hoursConfigured ||
    Boolean(
      hoursWindow &&
        hoursWindow.openDays > 0 &&
        hoursWindow.closedDateKeys.length === 0 &&
        hoursWindow.endSlot > hoursWindow.startSlot,
    );
  const startMin = hoursConfigured && hoursWindow ? hoursWindow.startSlot : undefined;
  const effectiveStop =
    draft.stopSlot === 0 && draft.startSlot > 0 ? END_SLOT : draft.stopSlot;
  const startMax =
    hoursConfigured && hoursWindow
      ? Math.min(
          Math.max(hoursWindow.startSlot, hoursWindow.endSlot - 1),
          Math.max(effectiveStop - 1, hoursWindow.startSlot),
        )
      : undefined;
  const stopMin =
    hoursConfigured && hoursWindow
      ? Math.max(hoursWindow.startSlot + 1, draft.startSlot + 1)
      : undefined;
  const stopMax = hoursConfigured && hoursWindow ? hoursWindow.endSlot : undefined;
  const stopIncludeEnd = Boolean(hoursConfigured && hoursWindow && hoursWindow.endSlot >= END_SLOT);

  const shiftSlots =
    draft.stopSlot > draft.startSlot
      ? draft.stopSlot - draft.startSlot
      : 96 - draft.startSlot + draft.stopSlot;
  const maxBreakSlots = Math.min(MAX_BREAK_SLOTS, Math.max(1, shiftSlots - 1));
  const shiftMinutes = shiftSlots * SLOT_MINUTES;
  const breakMinutes = draft.breaks.reduce((sum, item) => sum + item.durationMinutes, 0);
  const onClockMinutes = Math.max(0, shiftMinutes - breakMinutes);
  const overlap = breaksOverlap(draft.breaks);

  function toggleDay(day: string) {
    const selected = draft.days.includes(day)
      ? draft.days.filter((value) => value !== day)
      : [...draft.days, day];
    const nextWindow = scheduleWindowForDateKeys(hoursTemplate, selected);
    const clamped =
      nextWindow && nextWindow.openDays > 0 && nextWindow.endSlot > nextWindow.startSlot
        ? clampSlotsToWindow(draft.startSlot, draft.stopSlot, nextWindow)
        : { startSlot: draft.startSlot, stopSlot: draft.stopSlot };
    onChange({ ...draft, days: selected, ...clamped });
  }

  function addBreak() {
    const placement = defaultBreakPlacement(draft.breaks, shiftMinutes);
    if (!placement) return;
    onChange({
      ...draft,
      breaks: [...draft.breaks, placement],
    });
  }

  function toggleResponsibility(id: string) {
    const selected = draft.responsibilityIds.includes(id)
      ? draft.responsibilityIds.filter((value) => value !== id)
      : [...draft.responsibilityIds, id];
    onChange({ ...draft, responsibilityIds: selected });
  }

  const visibleResponsibilities = responsibilities.filter(
    (duty) => !duty.archived || draft.responsibilityIds.includes(duty.id),
  );
  const selectedWorker = workers.find((worker) => worker.id === draft.userId);
  const jobChoices = selectedWorker ? (selectedWorker.jobs ?? []) : jobs;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          {draft.shiftId ? "Edit shift" : "Create shift"}
        </h2>
        <div className="space-y-3">
          <div>
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1.5">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const active = draft.days.includes(key);
                const closed = Boolean(hoursForDateKey(hoursTemplate, key)?.closed);
                return (
                  <button
                    key={key}
                    type="button"
                    title={closed ? "Closed" : undefined}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      active ? "bg-teal text-white" : "bg-black/5 text-ink"
                    } ${closed && !active ? "opacity-50" : ""}`}
                    onClick={() => toggleDay(key)}
                  >
                    {format(day, "EEE")}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startSlot">Start</Label>
              <TimeSelect
                id="startSlot"
                value={draft.startSlot}
                minSlot={startMin}
                maxSlot={startMax}
                onChange={(startSlot) => onChange({ ...draft, startSlot })}
              />
            </div>
            <div>
              <Label htmlFor="stopSlot">Stop</Label>
              <TimeSelect
                id="stopSlot"
                value={draft.stopSlot}
                minSlot={stopMin}
                maxSlot={stopMax}
                includeEnd={stopIncludeEnd}
                onChange={(stopSlot) => onChange({ ...draft, stopSlot })}
              />
            </div>
          </div>
          {hoursConfigured && hoursWindow && draft.days.length ? (
            <p className="text-xs text-muted">
              {hoursWindow.openDays > 0 && hoursWindow.endSlot > hoursWindow.startSlot
                ? `Hours rules: earliest in ${formatSlot(hoursWindow.startSlot)}, latest out ${formatSlot(hoursWindow.endSlot)}.`
                : "Hours rules are configured, but the selected days have no open scheduling window."}
              {closedLabels.length
                ? ` Closed on ${closedLabels.join(", ")}.`
                : ""}
            </p>
          ) : null}
          <p className="text-sm text-muted">
            {formatHours(shiftMinutes * 60_000)} hours scheduled
            {breakMinutes > 0
              ? ` (${formatHours(onClockMinutes * 60_000)} on the clock)`
              : ""}
          </p>
          <div>
            <Label htmlFor="userId">Employee</Label>
            <Select
              id="userId"
              value={draft.userId}
              onChange={(e) => {
                const userId = e.target.value;
                const worker = workers.find((item) => item.id === userId);
                const choices = worker ? (worker.jobs ?? []) : jobs;
                const jobId = choices.some((job) => job.id === draft.jobId)
                  ? draft.jobId
                  : (worker?.primaryJobId ?? "");
                onChange({ ...draft, userId, jobId });
              }}
            >
              <option value="">Unassigned</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="jobId">Job</Label>
            <Select
              id="jobId"
              value={draft.jobId}
              onChange={(e) => onChange({ ...draft, jobId: e.target.value })}
            >
              {draft.userId ? null : <option value="">No job</option>}
              {jobChoices.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                <Label>Breaks</Label>
                <HelpTip topic="shiftBreaks" />
              </span>
              <Button type="button" variant="ghost" onClick={addBreak}>
                Add break
              </Button>
            </div>
            {draft.breaks.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <div>
                  <Label>Start</Label>
                  <BreakOffsetSelect
                    startSlot={draft.startSlot}
                    shiftMinutes={shiftMinutes}
                    durationMinutes={item.durationMinutes}
                    value={item.offsetMinutes}
                    onChange={(offsetMinutes) => {
                      const next = [...draft.breaks];
                      next[index] = { ...item, offsetMinutes };
                      onChange({ ...draft, breaks: next });
                    }}
                  />
                </div>
                <div>
                  <Label>Duration</Label>
                  <Select
                    value={String(item.durationMinutes)}
                    onChange={(event) => {
                      const next = [...draft.breaks];
                      next[index] = {
                        ...item,
                        durationMinutes: Number(event.target.value),
                      };
                      onChange({ ...draft, breaks: next });
                    }}
                  >
                    {Array.from({ length: maxBreakSlots }, (_, i) => (i + 1) * SLOT_MINUTES).map(
                      (minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} min
                        </option>
                      ),
                    )}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      ...draft,
                      breaks: draft.breaks.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          {responsibilitiesEnabled ? (
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1">
                <Label>Responsibilities</Label>
                <HelpTip topic="shiftResponsibilities" />
              </span>
              {visibleResponsibilities.length ? (
                <div className="max-h-40 space-y-1.5 overflow-auto rounded-md border border-border p-2">
                  {visibleResponsibilities.map((duty) => (
                    <label key={duty.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.responsibilityIds.includes(duty.id)}
                        onChange={() => toggleResponsibility(duty.id)}
                      />
                      <span>
                        {duty.name}
                        {duty.archived ? " (archived)" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink/60">No responsibilities yet.</p>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => onChange({ ...draft, published: e.target.checked })}
              />
              Published
            </label>
            <HelpTip topic="shiftPublish" />
          </div>

          {overlap ? (
            <p className="text-sm text-red-600">Breaks cannot overlap. Move or shorten one first.</p>
          ) : null}
          <FieldError message={error} />
          <div className="flex justify-between gap-2 pt-2">
            {draft.shiftId && onDelete ? (
              <Button type="button" variant="danger" onClick={onDelete}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {draft.shiftId ? (
                <Button type="button" variant="outline" onClick={onCopy} disabled={!hoursValid}>
                  Copy to days
                </Button>
              ) : null}
              <Button type="button" onClick={onSave} disabled={!hoursValid || overlap}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function breaksFromShift(startIso: string, breaks: { start: string; stop: string }[]) {
  const start = parseISO(startIso).getTime();
  return breaks.map((item) => ({
    offsetMinutes: Math.round((parseISO(item.start).getTime() - start) / 60000),
    durationMinutes: Math.round(
      (parseISO(item.stop).getTime() - parseISO(item.start).getTime()) / 60000,
    ),
  }));
}
