import type { CalendarShift } from "@/components/scheduling/types";
import { formatHours, onClockMs } from "@/lib/scheduling/totals";

export function LaborSummary({
  shifts,
  overtimeEnabled,
}: {
  shifts: CalendarShift[];
  overtimeEnabled: boolean;
}) {
  const hoursMs = shifts.reduce((sum, shift) => sum + onClockMs(shift), 0);
  const otMs = shifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0);
  const flagged = shifts.filter((shift) => shift.warnings?.length);
  const violations = flagged.reduce((sum, shift) => sum + shift.warnings.length, 0);

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">Schedule overview</h2>
      <p className="mt-1 text-sm text-muted">
        Totals for the visible day or week, including overtime and meal-rule
        warnings after save.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted">Hours</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatHours(hoursMs)}</dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted">Overtime</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {overtimeEnabled ? formatHours(otMs) : "Off"}
          </dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted">Meal violations</dt>
          <dd className="text-lg font-semibold tabular-nums">{violations}</dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted">Shifts flagged</dt>
          <dd className="text-lg font-semibold tabular-nums">{flagged.length}</dd>
        </div>
      </dl>
    </section>
  );
}
