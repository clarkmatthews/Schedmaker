"use client";

import { formatSlot, SLOT_MINUTES, SLOTS_PER_DAY, slotOptions } from "@/lib/scheduling/time-grid";
import { Select } from "@/components/ui/input";

const OPTIONS = slotOptions();

export function TimeSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <Select
      id={id}
      value={String(value)}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {OPTIONS.map((option) => (
        <option key={option.index} value={option.index}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function BreakOffsetSelect({
  startSlot,
  shiftMinutes,
  durationMinutes,
  value,
  onChange,
}: {
  startSlot: number;
  shiftMinutes: number;
  durationMinutes: number;
  value: number;
  onChange: (offsetMinutes: number) => void;
}) {
  const lastOffset = Math.max(0, shiftMinutes - durationMinutes);
  const options = Array.from({ length: Math.floor(lastOffset / SLOT_MINUTES) + 1 }, (_, index) => {
    const offsetMinutes = index * SLOT_MINUTES;
    return {
      offsetMinutes,
      label: formatSlot((startSlot + index) % SLOTS_PER_DAY),
    };
  });

  return (
    <Select value={String(value)} onChange={(event) => onChange(Number(event.target.value))}>
      {options.map((option) => (
        <option key={option.offsetMinutes} value={option.offsetMinutes}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
