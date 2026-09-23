"use client";

import { useState } from "react";
import { updateMmsSettingsAction } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";

type SavedMms = {
  on: boolean;
  accountSid: string;
  fromNumber: string;
  managerPhone: string;
};

const lastSaved = new Map<string, SavedMms>();

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
  const saved = lastSaved.get(companyId);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(saved?.on ?? enabled);
  const [sid, setSid] = useState(saved?.accountSid ?? accountSid);
  const [from, setFrom] = useState(saved?.fromNumber ?? fromNumber);
  const [manager, setManager] = useState(saved?.managerPhone ?? managerPhone);
  const [token, setToken] = useState("");

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("mmsEnabled", on ? "true" : "false");
        const result = await updateMmsSettingsAction(companyId, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        lastSaved.set(companyId, {
          on,
          accountSid: sid,
          fromNumber: from,
          managerPhone: manager,
        });
        setToken("");
        setError(null);
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
          value={sid}
          autoComplete="off"
          onChange={(event) => setSid(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="mmsAuthToken">Twilio Auth Token</Label>
        <Input
          id="mmsAuthToken"
          name="mmsAuthToken"
          type="password"
          value={token}
          autoComplete="new-password"
          placeholder={authTokenSet ? "Leave blank to keep the saved token" : ""}
          onChange={(event) => setToken(event.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="mmsFromNumber">Twilio MMS From number</Label>
        <PhoneInput
          id="mmsFromNumber"
          name="mmsFromNumber"
          value={from}
          onValueChange={setFrom}
        />
      </div>
      <div>
        <Label htmlFor="mmsManagerPhone">Manager on duty phone</Label>
        <PhoneInput
          id="mmsManagerPhone"
          name="mmsManagerPhone"
          value={manager}
          onValueChange={setManager}
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
