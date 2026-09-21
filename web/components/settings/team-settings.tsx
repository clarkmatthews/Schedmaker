"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJobAction, updateJobAction, updateTeamAction } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { ColorSwatchPicker } from "@/components/settings/color-swatch-picker";

type Job = { id: string; name: string; color: string; archived: boolean };

const lastSaved = new Map<string, { name: string }>();

export function TeamSettings({
  companyId,
  team,
  jobs,
}: {
  companyId: string;
  team: {
    id: string;
    name: string;
    color: string;
  };
  jobs: Job[];
}) {
  const router = useRouter();
  const saved = lastSaved.get(team.id);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(saved?.name ?? team.name);

  return (
    <div className="space-y-8">
      <form
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const next = {
            name: String(formData.get("name") ?? name),
          };
          const result = await updateTeamAction(companyId, team.id, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          lastSaved.set(team.id, next);
          setError(null);
          setName(next.name);
        }}
      >
        <h2 className="text-lg font-semibold">Team settings</h2>
        <div>
          <Label htmlFor={`team-name-${team.id}`}>Name</Label>
          <Input
            id={`team-name-${team.id}`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
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
