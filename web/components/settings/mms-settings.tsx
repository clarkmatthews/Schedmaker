"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMmsSettingsAction } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function MmsSettings({
  companyId,
  enabled,
  accountSid,
  fromNumber,
  managerPhone,
  authTokenSet,
}: {
  companyId: string;
  enabled: boolean;
  accountSid: string;
  fromNumber: string;
  managerPhone: string;
  authTokenSet: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);

  return (
    <form
      className="max-w-xl space-y-4"
      action={async (formData) => {
        formData.set("mmsEnabled", on ? "true" : "false");
        const result = await updateMmsSettingsAction(companyId, formData);
        if (result.error) setError(result.error);
        else {
          setError(null);
          router.refresh();
        }
      }}
    >
      <p className="text-sm text-muted">
        Send a weekly schedule MMS through Twilio when you publish or republish a
        day or week. If this is off or incomplete, Schedmaker prints the message
        to the server console and saves the schedule image under{" "}
        <code>tmp/mms</code> for review.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
        />
        <span>
          Enable MMS schedule messages
          <span className="mt-0.5 block text-muted">
            Employees with a phone number receive the week image after Publish
            day or Publish week.
          </span>
        </span>
      </label>
      <div>
        <Label htmlFor="mmsAccountSid">Twilio Account SID</Label>
        <Input
          id="mmsAccountSid"
          name="mmsAccountSid"
          defaultValue={accountSid}
          autoComplete="off"
        />
      </div>
      <div>
        <Label htmlFor="mmsAuthToken">Twilio Auth Token</Label>
        <Input
          id="mmsAuthToken"
          name="mmsAuthToken"
          type="password"
          autoComplete="new-password"
          placeholder={authTokenSet ? "Leave blank to keep the saved token" : ""}
        />
      </div>
      <div>
        <Label htmlFor="mmsFromNumber">Twilio MMS From number</Label>
        <Input
          id="mmsFromNumber"
          name="mmsFromNumber"
          defaultValue={fromNumber}
          placeholder="+15551234567"
        />
      </div>
      <div>
        <Label htmlFor="mmsManagerPhone">Manager on duty phone</Label>
        <Input
          id="mmsManagerPhone"
          name="mmsManagerPhone"
          defaultValue={managerPhone}
          placeholder="+15557654321"
        />
        <p className="mt-1 text-xs text-muted">
          Included in the message so employees know who to call with questions.
        </p>
      </div>
      <FieldError message={error} />
      <Button type="submit">Save MMS settings</Button>
    </form>
  );
}
