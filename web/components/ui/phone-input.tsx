"use client";

import { useState } from "react";
import { formatPhoneInput } from "@/lib/phone";
import { Input } from "@/components/ui/input";

export function PhoneInput({
  id,
  name,
  value,
  defaultValue = "",
  disabled,
  onValueChange,
}: {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => formatPhoneInput(defaultValue));
  const shown = value !== undefined ? formatPhoneInput(value) : draft;

  return (
    <Input
      id={id}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(555) 555-0100"
      disabled={disabled}
      value={shown}
      onChange={(event) => {
        const next = formatPhoneInput(event.target.value);
        setDraft(next);
        onValueChange?.(next);
      }}
    />
  );
}
