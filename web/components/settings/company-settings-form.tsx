"use client";

import { useState } from "react";
import { updateCompanyAction } from "@/lib/actions/company";
import { TIMEZONES, WEEKDAYS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

const lastSaved = new Map<
  string,
  { name: string; timezone: string; weekStarts: string }
>();

export function CompanySettingsForm({
  company,
}: {
  company: {
    id: string;
    name: string;
    defaultTimezone: string;
    defaultDayWeekStarts: string;
  };
}) {
  const saved = lastSaved.get(company.id);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(saved?.name ?? company.name);
  const [timezone, setTimezone] = useState(saved?.timezone ?? company.defaultTimezone);
  const [weekStarts, setWeekStarts] = useState(
    saved?.weekStarts ?? company.defaultDayWeekStarts,
  );

  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const next = {
          name: String(formData.get("name") ?? name),
          timezone: String(formData.get("defaultTimezone") ?? timezone),
          weekStarts: String(formData.get("defaultDayWeekStarts") ?? weekStarts),
        };
        const result = await updateCompanyAction(company.id, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        lastSaved.set(company.id, next);
        setError(null);
        setName(next.name);
        setTimezone(next.timezone);
        setWeekStarts(next.weekStarts);
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="defaultTimezone">Default timezone</Label>
        <Select
          id="defaultTimezone"
          name="defaultTimezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        >
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="defaultDayWeekStarts">Week starts</Label>
        <p className="mb-1 text-sm text-muted">
          First day on every team calendar and workweek. Changing this updates
          all teams and recalculates weekly overtime.
        </p>
        <Select
          id="defaultDayWeekStarts"
          name="defaultDayWeekStarts"
          value={weekStarts}
          onChange={(event) => setWeekStarts(event.target.value)}
        >
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </Select>
      </div>
      <FieldError message={error} />
      <Button type="submit">Save company</Button>
    </form>
  );
}
