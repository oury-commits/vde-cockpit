"use client";

import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-cream/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-surface">
      <button
        type="button"
        aria-label="Diminuer"
        onClick={() => set(value - step)}
        className="grid size-8 place-items-center text-muted transition-colors hover:text-ink disabled:opacity-30"
        disabled={value <= min}
      >
        <Minus className="size-4" strokeWidth={2} />
      </button>
      <span className="w-9 text-center font-mono text-sm text-ink">{value}</span>
      <button
        type="button"
        aria-label="Augmenter"
        onClick={() => set(value + step)}
        className="grid size-8 place-items-center text-muted transition-colors hover:text-ink"
      >
        <Plus className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export function CheckRow({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-cream/50"
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
          checked
            ? "border-brand bg-brand text-cream"
            : "border-line bg-surface text-transparent",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}
