"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAuthDisabled } from "@/lib/auth/config";

/**
 * Protège les routes applicatives.
 * - `NEXT_PUBLIC_AUTH_DISABLED=true` (mode ouvert dev) → passant, aucune
 *   redirection. Réversible : repasser le flag à false.
 * - Supabase non configuré (mode démo local) → passant.
 * - Sinon → redirige vers /login tant qu'il n'y a pas de session.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { enabled, loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthDisabled && enabled && !loading && !session) {
      router.replace("/login");
    }
  }, [enabled, loading, session, router]);

  if (isAuthDisabled) return <>{children}</>;
  if (!enabled) return <>{children}</>;
  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        Chargement…
      </div>
    );
  }
  return <>{children}</>;
}
