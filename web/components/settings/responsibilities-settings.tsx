"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createResponsibilityAction,
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

export function ResponsibilitiesSettings({
  companyId,
  responsibilities,
}: {
  companyId: string;
  responsibilities: Duty[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function save(id: string, formData: FormData) {
    const result = await updateResponsibilityAction(companyId, id, formData);
    if (result.error) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {responsibilities.map((duty) => (
          <div
            key={duty.id}
            className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto]"
          >
            <form
              className="contents"
              action={async (formData) => {
                formData.set("archived", duty.archived ? "true" : "false");
                await save(duty.id, formData);
              }}
            >
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={duty.name} />
              </div>
              <div>
                <Label>Description</Label>
                <Input name="description" defaultValue={duty.description} />
              </div>
              <Button type="submit" variant="outline">
                Save
              </Button>
            </form>
            <form
              action={async () => {
                const formData = new FormData();
                formData.set("name", duty.name);
                formData.set("description", duty.description);
                formData.set("archived", duty.archived ? "false" : "true");
                await save(duty.id, formData);
              }}
            >
              <Button type="submit" variant="ghost">
                {duty.archived ? "Restore" : "Archive"}
              </Button>
            </form>
          </div>
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
    </div>
  );
}
