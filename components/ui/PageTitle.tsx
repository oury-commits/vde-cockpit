import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Titre de page en Instrument Serif italique. */
export function PageTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "font-serif text-[33px] italic leading-tight text-ink",
        className,
      )}
      {...props}
    />
  );
}
