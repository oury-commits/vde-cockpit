"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV } from "@/components/layout/nav";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { moduleForPath, peutVoirModule } from "@/lib/roles/permissions";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { identite } = useIdentity();

  const items = MOBILE_NAV.filter((i) => {
    const m = moduleForPath(i.href);
    return m === null || peutVoirModule(identite, m);
  });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-cream/10 bg-brand text-cream md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-gold" : "text-cream/60",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
            <span className="truncate">{item.label.split(" ")[0]}</span>
            {item.badge ? (
              <span className="absolute right-1/2 top-1.5 translate-x-3 rounded-full bg-gold px-1 font-mono text-[9px] font-semibold leading-tight text-brand">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
