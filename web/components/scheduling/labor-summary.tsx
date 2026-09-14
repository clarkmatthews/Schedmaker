import type { CalendarShift } from "@/components/scheduling/types";
import { estimatedLaborUsd, formatCurrencyUsd, formatHours, onClockMs } from "@/lib/scheduling/totals";

export function LaborSummary({
  shifts,
  overtimeEnabled,
  hourlyRates = {},
}: {
  shifts: CalendarShift[];
  overtimeEnabled: boolean;
  hourlyRates?: Record<string, number>;
}) {
  const hoursMs = shifts.reduce((sum, shift) => sum + onClockMs(shift), 0);
  const otMs = shifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0);
  const flagged = shifts.filter((shift) => shift.warnings?.length);
  const violations = flagged.reduce((sum, shift) => sum + shift.warnings.length, 0);
  const laborUsd = estimatedLaborUsd(shifts, hourlyRates);

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">Schedule overview</h2>
      <p className="mt-1 text-sm text-muted">
        Totals for the visible day or week, including overtime plus meal and
        minor-rule warnings after save. Estimated labor uses each employee’s
        hourly rate, with overtime at 1.5×. People without a rate are omitted.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <dt className="text-xs text-muted">Est. labor</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCurrencyUsd(laborUsd)}</dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted">Rule violations</dt>
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
