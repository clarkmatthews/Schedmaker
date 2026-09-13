"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCompanyAction } from "@/lib/actions/company";
import { TIMEZONES, WEEKDAYS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";

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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="max-w-xl space-y-3"
      action={async (formData) => {
        const result = await updateCompanyAction(company.id, formData);
        if (result.error) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={company.name} />
      </div>
      <div>
        <Label htmlFor="defaultTimezone">Default timezone</Label>
        <Select
          id="defaultTimezone"
          name="defaultTimezone"
          defaultValue={company.defaultTimezone}
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
        <Select
          id="defaultDayWeekStarts"
          name="defaultDayWeekStarts"
          defaultValue={company.defaultDayWeekStarts}
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
