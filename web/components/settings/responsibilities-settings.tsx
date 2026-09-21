"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createResponsibilityAction,
  setResponsibilitiesEnabledAction,
  updateResponsibilityAction,
} from "@/lib/actions/responsibilities";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";

type Duty = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
};

const lastEnabled = new Map<string, boolean>();
const lastDuties = new Map<string, { name: string; description: string }>();

export function ResponsibilitiesSettings({
  companyId,
  enabled,
  responsibilities,
}: {
  companyId: string;
  enabled: boolean;
  responsibilities: Duty[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(lastEnabled.get(companyId) ?? enabled);

  async function save(id: string, formData: FormData) {
    const result = await updateResponsibilityAction(companyId, id, formData);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={on}
            onChange={async (event) => {
              const next = event.target.checked;
              setOn(next);
              const result = await setResponsibilitiesEnabledAction(companyId, next);
              if (result.error) {
                setOn(!next);
                setError(result.error);
              } else {
                lastEnabled.set(companyId, next);
                setError(null);
              }
            }}
          />
          <span>
            <span className="block font-medium text-ink">Use responsibilities on shifts</span>
            <span className="mt-1 block text-muted">
              When this is off, duties are hidden on the create and edit shift
              forms. Existing assignments stay in the database.
            </span>
          </span>
        </label>
      </div>
      <FieldError message={error} />

      {on ? (
        <>
      <div className="space-y-3">
        {responsibilities.map((duty) => (
          <DutyEditor key={duty.id} duty={duty} onSave={save} />
        ))}
        {responsibilities.length === 0 ? (
          <p className="text-sm text-muted">No responsibilities yet.</p>
        ) : null}
      </div>

      <form
        className="max-w-xl space-y-3 rounded-md border border-dashed border-border p-4"
        action={async (formData) => {
          const result = await createResponsibilityAction(companyId, formData);
          if (result.error) setError(result.error);
          else {
            setError(null);
            router.refresh();
          }
        }}
      >
        <h3 className="font-medium">Add a responsibility</h3>
        <div>
          <Label htmlFor="dutyName">Name</Label>
          <Input id="dutyName" name="name" placeholder="Register coverage" required />
        </div>
        <div>
          <Label htmlFor="dutyDescription">Description</Label>
          <Textarea id="dutyDescription" name="description" rows={2} />
        </div>
        <FieldError message={error} />
        <Button type="submit">Add</Button>
      </form>
        </>
      ) : (
        <p className="text-sm text-muted">
          Turn this on to manage duties and assign them on shifts.
        </p>
      )}
    </div>
  );
}

function DutyEditor({
  duty,
  onSave,
}: {
  duty: Duty;
  onSave: (id: string, formData: FormData) => Promise<boolean>;
}) {
  const saved = lastDuties.get(duty.id);
  const [name, setName] = useState(saved?.name ?? duty.name);
  const [description, setDescription] = useState(saved?.description ?? duty.description);

  return (
    <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
      <form
        className="contents"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("archived", duty.archived ? "true" : "false");
          const ok = await onSave(duty.id, formData);
          if (ok) lastDuties.set(duty.id, { name, description });
        }}
      >
        <div>
          <Label>Name</Label>
          <Input name="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Input
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Save
        </Button>
      </form>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData();
          formData.set("name", name);
          formData.set("description", description);
          formData.set("archived", duty.archived ? "false" : "true");
          await onSave(duty.id, formData);
        }}
      >
        <Button type="submit" variant="ghost">
          {duty.archived ? "Restore" : "Archive"}
        </Button>
      </form>
    </div>
  );
}
