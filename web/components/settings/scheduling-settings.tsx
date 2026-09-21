"use client";

import { useState } from "react";
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
import {
  minorRulesForState,
  parseMinorRules,
  type MinorAgeBand,
  type MinorRules,
} from "@/lib/scheduling/minor-rules";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function hoursToMinutes(hours: number) {
  return Math.round(hours * 60);
}

type SavedScheduling = {
  locked: boolean;
  state: string;
  rules: MealRules;
  otRules: OvertimeRules;
  minor: MinorRules;
};

const lastSaved = new Map<string, SavedScheduling>();

export function SchedulingSettings({
  companyId,
  companyName,
  lockHistoricalSchedule,
  laborState,
  mealRules,
  overtimeRules,
  minorRules,
}: {
  companyId: string;
  companyName: string;
  lockHistoricalSchedule: boolean;
  laborState: string;
  mealRules: unknown;
  overtimeRules: unknown;
  minorRules: unknown;
}) {
  const saved = lastSaved.get(companyId);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(saved?.locked ?? lockHistoricalSchedule);
  const [state, setState] = useState(saved?.state ?? laborState);
  const [rules, setRules] = useState<MealRules>(
    saved?.rules ?? parseMealRules(mealRules) ?? mealRulesForState(laborState),
  );
  const [otRules, setOtRules] = useState<OvertimeRules>(
    saved?.otRules ?? parseOvertimeRules(overtimeRules) ?? overtimeRulesForState(laborState),
  );
  const [minor, setMinor] = useState<MinorRules>(
    saved?.minor ?? parseMinorRules(minorRules) ?? minorRulesForState(laborState),
  );

  function updateRule<K extends keyof MealRules>(key: K, value: MealRules[K]) {
    setRules((current) => ({ ...current, [key]: value }));
  }

  function updateOt<K extends keyof OvertimeRules>(key: K, value: OvertimeRules[K]) {
    setOtRules((current) => ({ ...current, [key]: value }));
  }

  function updateMinor<K extends keyof MinorRules>(key: K, value: MinorRules[K]) {
    setMinor((current) => ({ ...current, [key]: value }));
  }

  function updateBand(index: number, patch: Partial<MinorAgeBand>) {
    setMinor((current) => ({
      ...current,
      bands: current.bands.map((band, i) => (i === index ? { ...band, ...patch } : band)),
    }));
  }

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("lockHistoricalSchedule", locked ? "true" : "false");
        formData.set("laborState", state);
        formData.set("mealRules", JSON.stringify(rules));
        formData.set("overtimeRules", JSON.stringify(otRules));
        formData.set("minorRules", JSON.stringify(minor));
        const result = await updateSchedulingRulesAction(companyId, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        lastSaved.set(companyId, {
          locked,
          state,
          rules: structuredClone(rules),
          otRules: structuredClone(otRules),
          minor: structuredClone(minor),
        });
        setError(null);
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
            <span className="flex items-center gap-1 font-medium text-ink">
              Do not allow schedule changes on today or earlier dates
              <HelpTip topic="historicalLock" />
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
            Determines which labor pack is suggested for meal, overtime, and minor
            rules.
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
              setMinor(minorRulesForState(next));
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

      <div className="space-y-3 rounded-md border border-border p-4">
        <div>
          <h2 className="font-medium text-ink">Minor rules</h2>
          <p className="mt-1 text-sm text-muted">
            Employees under 18 with a date of birth on file are checked against
            these hour and curfew limits. School days are weekdays inside the
            school-year range. Weekends are always non-school days.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={minor.enabled}
            onChange={(event) => updateMinor("enabled", event.target.checked)}
          />
          Warn when minor hour or curfew rules are broken
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="schoolYearStart">School year start (MM-DD)</Label>
            <Input
              id="schoolYearStart"
              value={minor.schoolYearStart}
              placeholder="08-15"
              onChange={(event) => updateMinor("schoolYearStart", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="schoolYearEnd">School year end (MM-DD)</Label>
            <Input
              id="schoolYearEnd"
              value={minor.schoolYearEnd}
              placeholder="06-05"
              onChange={(event) => updateMinor("schoolYearEnd", event.target.value)}
            />
          </div>
        </div>
        {minor.bands.map((band, index) => (
          <div key={`${band.minAge}-${band.maxAge}`} className="space-y-3 border-t border-border pt-3">
            <h3 className="text-sm font-medium text-ink">
              Ages {band.minAge}–{band.maxAge}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`schoolDayHours-${index}`}>School day hours</Label>
                <Input
                  id={`schoolDayHours-${index}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={band.schoolDayHours}
                  onChange={(event) =>
                    updateBand(index, { schoolDayHours: Number(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`nonSchoolDayHours-${index}`}>Non-school day hours</Label>
                <Input
                  id={`nonSchoolDayHours-${index}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={band.nonSchoolDayHours}
                  onChange={(event) =>
                    updateBand(index, { nonSchoolDayHours: Number(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`schoolWeekHours-${index}`}>School-week hours</Label>
                <Input
                  id={`schoolWeekHours-${index}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={band.schoolWeekHours}
                  onChange={(event) =>
                    updateBand(index, { schoolWeekHours: Number(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`nonSchoolWeekHours-${index}`}>Non-school week hours</Label>
                <Input
                  id={`nonSchoolWeekHours-${index}`}
                  type="number"
                  min="0"
                  step="0.5"
                  value={band.nonSchoolWeekHours}
                  onChange={(event) =>
                    updateBand(index, { nonSchoolWeekHours: Number(event.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`earliestStart-${index}`}>Earliest start (hours from midnight)</Label>
                <Input
                  id={`earliestStart-${index}`}
                  type="number"
                  min="0"
                  step="0.25"
                  value={minutesToHours(band.earliestStartMinutes)}
                  onChange={(event) =>
                    updateBand(index, {
                      earliestStartMinutes: hoursToMinutes(Number(event.target.value)),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`latestEnd-${index}`}>Latest end (hours from midnight)</Label>
                <Input
                  id={`latestEnd-${index}`}
                  type="number"
                  min="0"
                  step="0.25"
                  value={minutesToHours(band.latestEndMinutes)}
                  onChange={(event) =>
                    updateBand(index, {
                      latestEndMinutes: hoursToMinutes(Number(event.target.value)),
                    })
                  }
                />
              </div>
              {band.summerLatestEndMinutes != null ? (
                <div>
                  <Label htmlFor={`summerLatest-${index}`}>
                    Summer latest end (June 1–Labor Day)
                  </Label>
                  <Input
                    id={`summerLatest-${index}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={minutesToHours(band.summerLatestEndMinutes)}
                    onChange={(event) =>
                      updateBand(index, {
                        summerLatestEndMinutes: hoursToMinutes(Number(event.target.value)),
                      })
                    }
                  />
                </div>
              ) : null}
              {band.latestEndBeforeNonSchoolMinutes != null ? (
                <div>
                  <Label htmlFor={`latestNonSchool-${index}`}>
                    Latest end before a non-school day (24.5 = 12:30 a.m.)
                  </Label>
                  <Input
                    id={`latestNonSchool-${index}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={minutesToHours(band.latestEndBeforeNonSchoolMinutes)}
                    onChange={(event) =>
                      updateBand(index, {
                        latestEndBeforeNonSchoolMinutes: hoursToMinutes(
                          Number(event.target.value),
                        ),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(band.dayBeforeNonSchoolUsesNonSchoolHours)}
                onChange={(event) =>
                  updateBand(index, {
                    dayBeforeNonSchoolUsesNonSchoolHours: event.target.checked,
                  })
                }
              />
              Allow non-school-day hours on the day before a non-school day
            </label>
          </div>
        ))}
      </div>

      <FieldError message={error} />
      <Button type="submit">Save scheduling rules</Button>
    </form>
  );
}
