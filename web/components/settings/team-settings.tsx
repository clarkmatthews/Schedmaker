"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJobAction, updateJobAction, updateTeamAction } from "@/lib/actions/teams";
import { TIMEZONES, WEEKDAYS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { ColorSwatchPicker } from "@/components/settings/color-swatch-picker";

type Job = { id: string; name: string; color: string; archived: boolean };

export function TeamSettings({
  companyId,
  team,
  jobs,
}: {
  companyId: string;
  team: {
    id: string;
    name: string;
    timezone: string;
    dayWeekStarts: string;
    color: string;
  };
  jobs: Job[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <form
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-5"
        action={async (formData) => {
          const result = await updateTeamAction(companyId, team.id, formData);
          if (result.error) setError(result.error);
          else {
            setError(null);
            router.refresh();
          }
        }}
      >
        <h2 className="text-lg font-semibold">Team settings</h2>
        <div>
          <Label htmlFor={`team-name-${team.id}`}>Name</Label>
          <Input id={`team-name-${team.id}`} name="name" defaultValue={team.name} />
        </div>
        <div>
          <Label htmlFor={`timezone-${team.id}`}>Timezone</Label>
          <Select id={`timezone-${team.id}`} name="timezone" defaultValue={team.timezone}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`week-${team.id}`}>Week starts</Label>
          <Select
            id={`week-${team.id}`}
            name="dayWeekStarts"
            defaultValue={team.dayWeekStarts}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Color</Label>
          <ColorSwatchPicker name="color" defaultValue={team.color} />
        </div>
        <FieldError message={error} />
        <Button type="submit">Save team</Button>
      </form>

      <section className="rounded-lg border border-border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Jobs</h2>
        <div className="space-y-4">
          {jobs.map((job) => (
            <form
              key={job.id}
              className="space-y-2 rounded-md border border-border p-3"
              action={async (formData) => {
                await updateJobAction(companyId, team.id, job.id, formData);
                router.refresh();
              }}
            >
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={job.name} />
              </div>
              <div>
                <Label>Color</Label>
                <ColorSwatchPicker name="color" defaultValue={job.color} />
              </div>
              <input type="hidden" name="archived" value={job.archived ? "true" : "false"} />
              <Button type="submit" variant="outline">
                Update
              </Button>
            </form>
          ))}
        </div>
        <form
          className="mt-6 max-w-xl space-y-3"
          action={async (formData) => {
            await createJobAction(companyId, team.id, formData);
            router.refresh();
          }}
        >
          <div>
            <Label htmlFor={`jobName-${team.id}`}>New job</Label>
            <Input id={`jobName-${team.id}`} name="name" placeholder="Server" required />
          </div>
          <div>
            <Label>Color</Label>
            <ColorSwatchPicker name="color" defaultValue="48B7AB" />
          </div>
          <Button type="submit">Add job</Button>
        </form>
      </section>
    </div>
  );
}
