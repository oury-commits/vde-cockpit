"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/components/layout/nav";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { moduleForPath, peutVoirModule } from "@/lib/roles/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-gold/15 text-cream"
          : "text-cream/70 hover:bg-white/5 hover:text-cream",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-brand">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { enabled, user, signOut } = useAuth();
  const { identite } = useIdentity();

  // La nav ne montre que les modules autorisés (le blocage réel est dans
  // RouteGuard : masquer sans bloquer serait une fausse sécurité).
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => {
      const m = moduleForPath(i.href);
      return m === null || peutVoirModule(identite, m);
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col overflow-y-auto bg-brand text-cream md:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pb-1.5 pt-5">
        <div className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-gold text-[19px] font-bold text-brand">
          V
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-[0.02em]">
            Vision Digital Energies
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/50">
            VDE Cockpit
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        {sections.map((section, i) => (
          <div key={section.title ?? `section-${i}`} className="mt-3 px-3 first:mt-0">
            {section.title ? (
              <div className="px-3 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cream/40">
                {section.title}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profil */}
      {/* TODO: brancher données réelles — profil statique tant que l'auth n'est
          pas active ; l'email réel vient de la session dès Supabase configuré. */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-cream/10 p-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/20 text-xs font-semibold text-gold">
          OD
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">Oury</div>
          <div className="truncate text-[10.5px] text-cream/55">
            {user?.email ?? "oury@visiondigitalenergies.fr"}
          </div>
        </div>
        {enabled ? (
          <button
            type="button"
            aria-label="Se déconnecter"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-cream/60 transition-colors hover:bg-white/5 hover:text-cream"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </aside>
  );
}
