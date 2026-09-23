"use client";

import { useMemo, useState, type ReactNode } from "react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { CalendarShift } from "@/components/scheduling/types";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { estimatedLaborUsd, formatCurrencyUsd, formatHours, onClockMs } from "@/lib/scheduling/totals";

type DialogKind = "violations" | "overtime" | "labor";

type ViolationRow = {
  key: string;
  employee: string;
  date: string;
  sortAt: number;
  message: string;
};

type OvertimeRow = {
  key: string;
  employee: string;
  otMs: number;
  dates: string;
};

type LaborBar = {
  key: string;
  jobName: string;
  color: string;
  amount: number;
};

function SummaryDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
        <div className="mt-4">{children}</div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  onClick,
  valueClassName,
  help,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  valueClassName?: string;
  help?: ReactNode;
}) {
  const valueClass = `block text-lg font-semibold tabular-nums ${valueClassName ?? ""}`;
  if (help) {
    return (
      <div className="rounded-md border border-border px-3 py-2">
        <span className="flex items-center gap-1 text-xs text-muted">
          {label}
          {help}
        </span>
        {onClick ? (
          <button type="button" className={`${valueClass} text-left hover:text-teal`} onClick={onClick}>
            {value}
          </button>
        ) : (
          <span className={valueClass}>{value}</span>
        )}
      </div>
    );
  }
  const body = (
    <>
      <span className="block text-xs text-muted">{label}</span>
      <span className={valueClass}>{value}</span>
    </>
  );
  if (!onClick) {
    return <div className="rounded-md border border-border px-3 py-2">{body}</div>;
  }
  return (
    <button
      type="button"
      className="rounded-md border border-border px-3 py-2 text-left hover:border-teal hover:bg-teal/5"
      onClick={onClick}
    >
      {body}
    </button>
  );
}

export function LaborSummary({
  shifts,
  overtimeEnabled,
  timezone,
}: {
  shifts: CalendarShift[];
  overtimeEnabled: boolean;
  timezone: string;
}) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const countedShifts = shifts.filter((shift) => !shift.external);
  const hoursMs = countedShifts.reduce((sum, shift) => sum + onClockMs(shift), 0);
  const otMs = countedShifts.reduce((sum, shift) => sum + (shift.otMs ?? 0), 0);
  const flagged = useMemo(
    () => countedShifts.filter((shift) => shift.warnings?.length),
    [countedShifts],
  );
  const violations = flagged.reduce((sum, shift) => sum + shift.warnings.length, 0);
  const laborUsd = estimatedLaborUsd(countedShifts);

  const violationRows = useMemo(() => {
    const items: ViolationRow[] = [];
    for (const shift of flagged) {
      const start = parseISO(shift.start);
      const date = formatInTimeZone(start, timezone, "EEE, MMM d");
      const employee = shift.userName || "Unassigned";
      for (const warning of shift.warnings) {
        items.push({
          key: `${shift.id}-${warning.code}`,
          employee,
          date,
          sortAt: start.getTime(),
          message: warning.message,
        });
      }
    }
    return items.sort((a, b) => {
      if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt;
      const byName = a.employee.localeCompare(b.employee);
      if (byName) return byName;
      return a.message.localeCompare(b.message);
    });
  }, [flagged, timezone]);

  const overtimeRows = useMemo(() => {
    const byEmployee = new Map<
      string,
      { employee: string; otMs: number; dates: Map<string, { label: string; sortAt: number }> }
    >();
    for (const shift of countedShifts) {
      const shiftOt = shift.otMs ?? 0;
      if (shiftOt <= 0) continue;
      const key = shift.userId || "unassigned";
      const start = parseISO(shift.start);
      const dateKey = formatInTimeZone(start, timezone, "yyyy-MM-dd");
      const current = byEmployee.get(key) ?? {
        employee: shift.userName || "Unassigned",
        otMs: 0,
        dates: new Map<string, { label: string; sortAt: number }>(),
      };
      current.otMs += shiftOt;
      current.employee = shift.userName || current.employee;
      current.dates.set(dateKey, {
        label: formatInTimeZone(start, timezone, "EEE, MMM d"),
        sortAt: start.getTime(),
      });
      byEmployee.set(key, current);
    }
    return [...byEmployee.entries()]
      .map(([key, row]) => ({
        key,
        employee: row.employee,
        otMs: row.otMs,
        dates: [...row.dates.values()]
          .sort((a, b) => a.sortAt - b.sortAt)
          .map((item) => item.label)
          .join(" · "),
      }))
      .sort((a, b) => b.otMs - a.otMs || a.employee.localeCompare(b.employee));
  }, [countedShifts, timezone]);

  const laborBars = useMemo(() => {
    const byJob = new Map<string, LaborBar>();
    for (const shift of countedShifts) {
      if (!shift.userId) continue;
      const rate = shift.payRate;
      if (!rate || !Number.isFinite(rate) || rate <= 0) continue;
      const amount =
        ((shift.regularMs ?? 0) / 3_600_000) * rate +
        ((shift.otMs ?? 0) / 3_600_000) * rate * 1.5;
      if (amount <= 0) continue;
      const key = shift.jobId || "none";
      const current = byJob.get(key) ?? {
        key,
        jobName: shift.jobName || "No job",
        color: shift.jobColor || "5B5B5B",
        amount: 0,
      };
      current.amount += amount;
      if (shift.jobName) current.jobName = shift.jobName;
      if (shift.jobColor) current.color = shift.jobColor;
      byJob.set(key, current);
    }
    return [...byJob.values()].sort((a, b) => b.amount - a.amount || a.jobName.localeCompare(b.jobName));
  }, [countedShifts]);

  const maxLabor = laborBars[0]?.amount ?? 0;

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h2 className="flex items-center gap-1 text-sm font-semibold text-ink">
        Schedule overview
        <HelpTip topic="laborOverview" />
      </h2>
      <p className="mt-1 text-sm text-muted">
        Totals for the visible day or week, including overtime plus meal and
        minor-rule warnings after save. Estimated labor uses the job rate, or the
        employee’s override when that is above $0.00. Overtime is 1.5×. Shifts
        without a rate are omitted.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile label="Hours" value={formatHours(hoursMs)} />
        <SummaryTile
          label="Overtime"
          value={overtimeEnabled ? formatHours(otMs) : "Off"}
          onClick={overtimeEnabled ? () => setDialog("overtime") : undefined}
        />
        <SummaryTile
          label="Est. labor"
          value={formatCurrencyUsd(laborUsd)}
          onClick={() => setDialog("labor")}
        />
        <SummaryTile
          label="Rule violations"
          value={String(violations)}
          valueClassName={violations > 0 ? "text-red-700" : undefined}
          onClick={violations > 0 ? () => setDialog("violations") : undefined}
          help={<HelpTip topic="laborWarnings" />}
        />
        <SummaryTile label="Shifts flagged" value={String(flagged.length)} />
      </dl>

      {dialog === "violations" ? (
        <SummaryDialog
          title="Rule violations"
          description="Meal and minor-rule warnings on the visible day or week."
          onClose={() => setDialog(null)}
        >
          <ul className="space-y-3">
            {violationRows.map((row) => (
              <li key={row.key} className="rounded-md border border-border px-3 py-2">
                <p className="text-sm font-semibold text-ink">{row.employee}</p>
                <p className="text-xs text-muted">{row.date}</p>
                <p className="mt-1 text-sm text-ink">{row.message}</p>
              </li>
            ))}
          </ul>
        </SummaryDialog>
      ) : null}

      {dialog === "overtime" ? (
        <SummaryDialog
          title="Overtime"
          description="Employees with overtime on the visible day or week."
          onClose={() => setDialog(null)}
        >
          {overtimeRows.length ? (
            <ul className="space-y-3">
              {overtimeRows.map((row) => (
                <li key={row.key} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{row.employee}</p>
                    <p className="text-sm font-semibold tabular-nums">{formatHours(row.otMs)} hours</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">{row.dates}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No overtime is scheduled in this view.</p>
          )}
        </SummaryDialog>
      ) : null}

      {dialog === "labor" ? (
        <SummaryDialog
          title="Estimated labor"
          description="Dollar allocation by job, using each employee’s hourly rate with overtime at 1.5×. People without a rate are omitted."
          onClose={() => setDialog(null)}
        >
          {laborBars.length ? (
            <ul className="space-y-3" aria-label="Estimated labor by job">
              {laborBars.map((bar) => {
                const width = maxLabor > 0 ? Math.max((bar.amount / maxLabor) * 100, 4) : 0;
                return (
                  <li key={bar.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{bar.jobName}</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrencyUsd(bar.amount)}
                      </p>
                    </div>
                    <div className="h-4 overflow-hidden rounded bg-neutral-100">
                      <div
                        className="h-full rounded"
                        style={{ width: `${width}%`, backgroundColor: `#${bar.color}` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No estimated labor to chart. Add hourly rates to employees to include them.
            </p>
          )}
        </SummaryDialog>
      ) : null}
    </section>
  );
}
