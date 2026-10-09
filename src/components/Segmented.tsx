"use client";

/* A segmented control: shadcn's ToggleGroup (Radix: radio semantics, arrow-key
 * navigation) with a knob that slides to the chosen option (motion layoutId). */

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  render = (o) => o,
  className,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  render?: (o: T) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      // Radix allows deselecting the active item; a segmented control always has one.
      onValueChange={(v) => v && onChange(v as T)}
      spacing={1}
      className={cn("bg-muted w-full rounded-lg p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o}
          value={o}
          className="text-muted-foreground hover:text-foreground data-[state=on]:text-foreground relative h-8 flex-1 px-3 text-[13px] font-normal hover:bg-transparent data-[state=on]:bg-transparent data-[state=on]:font-medium max-md:h-10"
        >
          {o === value && (
            <motion.span
              layoutId={`knob-${id}`}
              aria-hidden
              className="bg-knob absolute inset-0 rounded-md shadow-sm"
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
            />
          )}
          <span className="relative inline-flex items-center gap-1.5">
            {render(o)}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
