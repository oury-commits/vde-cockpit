"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Protège les routes applicatives. Si l'auth est désactivée (Supabase non
 * configuré, Phase 2A) → laisse passer (mode démo). Sinon, redirige vers
 * /login tant qu'il n'y a pas de session.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { enabled, loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (enabled && !loading && !session) {
      router.replace("/login");
    }
  }, [enabled, loading, session, router]);

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
