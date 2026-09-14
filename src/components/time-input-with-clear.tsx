"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A blank time field now means something specific (e.g. the "no arrival
// today, continuing from last night" half of a night-shift pairing) — so
// once a value is typed in, there needs to be an obvious, one-click way
// back to blank. Native time inputs don't reliably offer that.
export function TimeInputWithClear({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="time"
        className={cn("pr-6", className)}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear"
          className="absolute top-1/2 right-1 flex size-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
