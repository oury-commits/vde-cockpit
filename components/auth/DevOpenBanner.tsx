import { ShieldOff } from "lucide-react";
import { isAuthDisabled } from "@/lib/auth/config";

/**
 * Bandeau permanent tant que le mode ouvert (dev) est actif — pour ne jamais
 * oublier dans quel état tourne l'app. Disparaît de lui-même dès que
 * NEXT_PUBLIC_AUTH_DISABLED repasse à false.
 */
export function DevOpenBanner() {
  if (!isAuthDisabled) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 bg-alert/10 px-3 py-1 text-[11px] font-medium text-alert">
      <ShieldOff className="size-3 shrink-0" strokeWidth={2} />
      <span>Mode ouvert (dev) — auth désactivée · local uniquement</span>
    </div>
  );
}
