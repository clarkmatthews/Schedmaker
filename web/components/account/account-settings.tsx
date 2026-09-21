"use client";

import { useState } from "react";
import { updateAccountAction, updatePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { FieldError, Input, Label } from "@/components/ui/input";

export function AccountSettings({
  user,
  icalUrl,
}: {
  user: {
    name: string;
    email: string;
    phoneNumber: string | null;
    photoUrl: string;
  };
  icalUrl: string;
}) {
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountOk, setAccountOk] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <form
        className="space-y-3 rounded-lg border border-border bg-white p-5"
        action={async (formData) => {
          const result = await updateAccountAction(formData);
          if (result.error) {
            setAccountError(result.error);
            setAccountOk(false);
          } else {
            setAccountError(null);
            setAccountOk(true);
          }
        }}
      >
        <h1 className="text-lg font-semibold">Account</h1>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={user.name} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={user.email} disabled />
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone</Label>
          <Input id="phoneNumber" name="phoneNumber" defaultValue={user.phoneNumber ?? ""} />
        </div>
        <div>
          <Label htmlFor="photoUrl">Photo URL</Label>
          <Input id="photoUrl" name="photoUrl" defaultValue={user.photoUrl} />
        </div>
        <FieldError message={accountError} />
        {accountOk ? <p className="text-sm text-teal-dark">Saved.</p> : null}
        <Button type="submit">Save profile</Button>
      </form>

      <form
        className="space-y-3 rounded-lg border border-border bg-white p-5"
        action={async (formData) => {
          const result = await updatePasswordAction(formData);
          if (result.error) {
            setPasswordError(result.error);
            setPasswordOk(false);
          } else {
            setPasswordError(null);
            setPasswordOk(true);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Password</h2>
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <FieldError message={passwordError} />
        {passwordOk ? <p className="text-sm text-teal-dark">Password updated.</p> : null}
        <Button type="submit">Update password</Button>
      </form>

      <section className="space-y-2 rounded-lg border border-border bg-white p-5">
        <h2 className="flex items-center gap-1 text-lg font-semibold">
          Calendar feed
          <HelpTip topic="icalFeed" />
        </h2>
        <p className="text-sm text-muted">
          Subscribe to your published shifts. Keep this URL private.
        </p>
        <Input readOnly value={icalUrl} />
      </section>
    </div>
  );
}
