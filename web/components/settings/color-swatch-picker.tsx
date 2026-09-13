"use client";

import { useState } from "react";
import { COLOR_SWATCHES } from "@/lib/settings/palette";
import { cn } from "@/lib/utils";

export function ColorSwatchPicker({
  name,
  value,
  defaultValue = "48B7AB",
  onChange,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (color: string) => void;
}) {
  const [internal, setInternal] = useState(value ?? defaultValue);
  const selected = (value ?? internal).replace("#", "").toUpperCase();
  const extras = COLOR_SWATCHES.includes(selected as (typeof COLOR_SWATCHES)[number])
    ? []
    : [selected];

  function choose(color: string) {
    setInternal(color);
    onChange?.(color);
  }

  return (
    <div>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <div className="grid grid-cols-10 gap-1.5">
        {[...COLOR_SWATCHES, ...extras].map((color) => (
          <button
            key={color}
            type="button"
            aria-label="Select color"
            aria-pressed={selected === color}
            className={cn(
              "h-6 rounded-sm border-2",
              selected === color ? "border-ink" : "border-transparent",
            )}
            style={{ backgroundColor: `#${color}` }}
            onClick={() => choose(color)}
          />
        ))}
      </div>
    </div>
  );
}
