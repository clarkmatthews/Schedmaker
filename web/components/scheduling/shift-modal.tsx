"use client";

import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select } from "@/components/ui/input";
import { BreakOffsetSelect, TimeSelect } from "@/components/scheduling/time-select";
import type { BreakInput } from "@/lib/actions/shifts";
import { breaksOverlap, firstOpenBreakOffset } from "@/lib/scheduling/break-rules";
import { MAX_BREAK_SLOTS, SLOT_MINUTES } from "@/lib/scheduling/time-grid";
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
  error: string | null;
  onChange: (draft: ShiftDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const shiftSlots =
    draft.stopSlot > draft.startSlot
      ? draft.stopSlot - draft.startSlot
      : 96 - draft.startSlot + draft.stopSlot;
  const maxBreakSlots = Math.min(MAX_BREAK_SLOTS, Math.max(1, shiftSlots - 1));
  const shiftMinutes = shiftSlots * SLOT_MINUTES;
  const overlap = breaksOverlap(draft.breaks);

  function toggleDay(day: string) {
    const selected = draft.days.includes(day)
      ? draft.days.filter((value) => value !== day)
      : [...draft.days, day];
    onChange({ ...draft, days: selected });
  }

  function addBreak() {
    const offsetMinutes = firstOpenBreakOffset(draft.breaks, SLOT_MINUTES, shiftMinutes);
    if (offsetMinutes == null) return;
    onChange({
      ...draft,
      breaks: [...draft.breaks, { offsetMinutes, durationMinutes: SLOT_MINUTES }],
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
                return (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      active ? "bg-teal text-white" : "bg-black/5 text-ink"
                    }`}
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
                onChange={(startSlot) => onChange({ ...draft, startSlot })}
              />
            </div>
            <div>
              <Label htmlFor="stopSlot">Stop</Label>
              <TimeSelect
                id="stopSlot"
                value={draft.stopSlot}
                onChange={(stopSlot) => onChange({ ...draft, stopSlot })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="userId">Employee</Label>
            <Select
              id="userId"
              value={draft.userId}
              onChange={(e) => onChange({ ...draft, userId: e.target.value })}
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
              <option value="">No job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => onChange({ ...draft, published: e.target.checked })}
            />
            Published
          </label>

          <div className="space-y-2">
            <Label>Responsibilities</Label>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Breaks</Label>
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
                <Button type="button" variant="outline" onClick={onCopy}>
                  Copy to days
                </Button>
              ) : null}
              <Button type="button" onClick={onSave}>
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
