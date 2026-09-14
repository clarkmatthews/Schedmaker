"use client";

import {
  END_SLOT,
  endSlotOptions,
  formatSlot,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  slotOptions,
} from "@/lib/scheduling/time-grid";
import { Select } from "@/components/ui/input";

const START_OPTIONS = slotOptions();
const END_OPTIONS = endSlotOptions();

export function TimeSelect({
  id,
  value,
  onChange,
  minSlot,
  maxSlot,
  includeEnd,
}: {
  id?: string;
  value: number;
  onChange: (index: number) => void;
  minSlot?: number;
  maxSlot?: number;
  includeEnd?: boolean;
}) {
  const all = includeEnd ? END_OPTIONS : START_OPTIONS;
  const min = minSlot ?? 0;
  const max = maxSlot ?? (includeEnd ? END_SLOT : SLOTS_PER_DAY - 1);
  const options = all.filter((option) => option.index >= min && option.index <= max);
  if (value != null && !options.some((option) => option.index === value)) {
    const extra = all.find((option) => option.index === value);
    if (extra) {
      options.push(extra);
      options.sort((a, b) => a.index - b.index);
    }
  }

  return (
    <Select
      id={id}
      value={String(value)}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {options.map((option) => (
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
