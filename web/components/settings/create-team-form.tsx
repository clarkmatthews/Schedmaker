"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeamAction } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { ColorSwatchPicker } from "@/components/settings/color-swatch-picker";

export function CreateTeamForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 max-w-md space-y-3 rounded-lg border border-border bg-white p-4"
      action={async (formData) => {
        const result = await createTeamAction(companyId, formData);
        if (result.error) setError(result.error);
        else if (result.teamId) {
          router.push(`/app/companies/${companyId}/settings?section=teams`);
        }
      }}
    >
      <h2 className="font-semibold">Add a team</h2>
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label>Color</Label>
        <ColorSwatchPicker name="color" defaultValue="48B7AB" />
      </div>
      <FieldError message={error} />
      <Button type="submit">Create team</Button>
    </form>
  );
}
