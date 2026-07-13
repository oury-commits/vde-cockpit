import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "gold" | "muted" | "alert";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  gold: "bg-gold/20 text-gold-ink",
  muted: "bg-muted/15 text-muted",
  alert: "bg-alert/10 text-alert",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({
  tone = "muted",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
