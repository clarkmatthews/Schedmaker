"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction, updatePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function ForcePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        action={async (formData) => {
          setPending(true);
          const result = await updatePasswordAction(formData);
          if (result?.error) {
            setError(result.error);
            setPending(false);
            return;
          }
          router.push("/app");
          router.refresh();
        }}
      >
        <div>
          <Label htmlFor="currentPassword">Temporary password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <FieldError message={error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </form>
      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Log out
        </Button>
      </form>
    </div>
  );
}
