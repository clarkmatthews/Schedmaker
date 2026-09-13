"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSchedulingRulesAction } from "@/lib/actions/company";
import {
  mealRulesForState,
  overtimeRulesForState,
  parseMealRules,
  parseOvertimeRules,
  US_STATES,
  type MealRules,
  type OvertimeRules,
} from "@/lib/scheduling/labor-rules";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

export function SchedulingSettings({
  companyId,
  companyName,
  lockHistoricalSchedule,
  laborState,
  mealRules,
  overtimeRules,
}: {
  companyId: string;
  companyName: string;
  lockHistoricalSchedule: boolean;
  laborState: string;
  mealRules: unknown;
  overtimeRules: unknown;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(lockHistoricalSchedule);
  const [state, setState] = useState(laborState);
  const [rules, setRules] = useState<MealRules>(
    parseMealRules(mealRules) ?? mealRulesForState(laborState),
  );
  const [otRules, setOtRules] = useState<OvertimeRules>(
    parseOvertimeRules(overtimeRules) ?? overtimeRulesForState(laborState),
  );

  function updateRule<K extends keyof MealRules>(key: K, value: MealRules[K]) {
    setRules((current) => ({ ...current, [key]: value }));
  }

  function updateOt<K extends keyof OvertimeRules>(key: K, value: OvertimeRules[K]) {
    setOtRules((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="max-w-xl space-y-4"
      action={async (formData) => {
        formData.set("lockHistoricalSchedule", locked ? "true" : "false");
        formData.set("laborState", state);
        formData.set("mealRules", JSON.stringify(rules));
        formData.set("overtimeRules", JSON.stringify(otRules));
        const result = await updateSchedulingRulesAction(companyId, formData);
        if (result.error) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      }}
    >
      <p className="text-sm text-muted">
        Rules for <span className="font-medium text-ink">{companyName}</span>. Other
        brands can set these independently. Choosing a state loads that state’s
        defaults; you can then tune the numbers.
      </p>
      <div className="rounded-md border border-border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />
          <span>
            <span className="block font-medium text-ink">
              Do not allow schedule changes on today or earlier dates
            </span>
            <span className="mt-1 block text-muted">
              When this is on, managers cannot create, edit, move, copy, delete, or
              publish shifts for the current day or any prior day in this location’s
              timezone.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <div>
          <h2 className="font-medium text-ink">Location state</h2>
          <p className="mt-1 text-sm text-muted">
            Determines which labor pack is suggested for meal and overtime rules.
            Minor rules will use this same state later.
          </p>
        </div>
        <div>
          <Label htmlFor="laborState">State</Label>
          <Select
            id="laborState"
            value={state}
            onChange={(event) => {
              const next = event.target.value;
              setState(next);
              setRules(mealRulesForState(next));
              setOtRules(overtimeRulesForState(next));
            }}
          >
            {US_STATES.map((item) => (
              <option key={item.code || "none"} value={item.code}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <div>
          <h2 className="font-medium text-ink">Meal breaks</h2>
          <p className="mt-1 text-sm text-muted">
            Shifts that break these rules show a red warning on the schedule. A
            scheduled break of at least the meal length counts. Employee waivers
            only suppress the first meal when the shift is within the waiver limit.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rules.enabled}
            onChange={(event) => updateRule("enabled", event.target.checked)}
          />
          Warn when meal-break rules are broken
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstAfterHours">First meal after (hours)</Label>
            <Input
              id="firstAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.firstAfterHours}
              onChange={(event) => updateRule("firstAfterHours", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="firstMinutes">First meal length (minutes)</Label>
            <Input
              id="firstMinutes"
              type="number"
              min="1"
              step="1"
              value={rules.firstMinutes}
              onChange={(event) => updateRule("firstMinutes", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="firstStartByHours">Must start by hour</Label>
            <Input
              id="firstStartByHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.firstStartByHours}
              onChange={(event) =>
                updateRule("firstStartByHours", Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="firstWaiverMaxHours">Waiver allowed up to (hours)</Label>
            <Input
              id="firstWaiverMaxHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.firstWaiverMaxHours}
              onChange={(event) =>
                updateRule("firstWaiverMaxHours", Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="secondAfterHours">Second meal after (hours)</Label>
            <Input
              id="secondAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.secondAfterHours}
              onChange={(event) =>
                updateRule("secondAfterHours", Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="secondMinutes">Second meal length (minutes)</Label>
            <Input
              id="secondMinutes"
              type="number"
              min="1"
              step="1"
              value={rules.secondMinutes}
              onChange={(event) => updateRule("secondMinutes", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="secondStartByHours">Second must start by hour</Label>
            <Input
              id="secondStartByHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.secondStartByHours}
              onChange={(event) =>
                updateRule("secondStartByHours", Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="secondWaiverMaxHours">Second waiver up to (hours)</Label>
            <Input
              id="secondWaiverMaxHours"
              type="number"
              min="0"
              step="0.5"
              value={rules.secondWaiverMaxHours}
              onChange={(event) =>
                updateRule("secondWaiverMaxHours", Number(event.target.value))
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <div>
          <h2 className="font-medium text-ink">Overtime</h2>
          <p className="mt-1 text-sm text-muted">
            Hours beyond these thresholds count as overtime on the schedule
            (Hours/OT). California pays daily overtime after 8 hours, weekly after
            40, and treats the seventh day worked in a workweek as overtime.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={otRules.enabled}
            onChange={(event) => updateOt("enabled", event.target.checked)}
          />
          Apply overtime rules to schedule totals
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dailyAfterHours">Daily overtime after (hours)</Label>
            <Input
              id="dailyAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={otRules.dailyAfterHours}
              onChange={(event) => updateOt("dailyAfterHours", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="dailyDoubleAfterHours">Daily double time after (hours)</Label>
            <Input
              id="dailyDoubleAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={otRules.dailyDoubleAfterHours}
              onChange={(event) =>
                updateOt("dailyDoubleAfterHours", Number(event.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="weeklyAfterHours">Weekly overtime after (hours)</Label>
            <Input
              id="weeklyAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={otRules.weeklyAfterHours}
              onChange={(event) => updateOt("weeklyAfterHours", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="seventhDayDoubleAfterHours">
              Seventh-day double time after (hours)
            </Label>
            <Input
              id="seventhDayDoubleAfterHours"
              type="number"
              min="0"
              step="0.5"
              value={otRules.seventhDayDoubleAfterHours}
              onChange={(event) =>
                updateOt("seventhDayDoubleAfterHours", Number(event.target.value))
              }
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={otRules.seventhDayEnabled}
            onChange={(event) => updateOt("seventhDayEnabled", event.target.checked)}
          />
          Count the seventh day worked in the workweek as overtime
        </label>
      </div>

      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
        <p className="font-medium text-ink">Coming next</p>
        <p className="mt-1">
          Minor hour and curfew rules will use this location state and the same
          warning icon on the schedule.
        </p>
      </div>

      <FieldError message={error} />
      <Button type="submit">Save scheduling rules</Button>
    </form>
  );
}
