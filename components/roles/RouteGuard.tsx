"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { moduleForPath, peutVoirModule, routeDeRepli } from "@/lib/roles/permissions";

/**
 * Blocage de route. Masquer l'entrée de nav ne suffit pas : sans ce garde, une
 * URL tapée à la main donnerait accès au module. Deny by default — un compte
 * non assigné ou désactivé n'atteint aucune route métier.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { identite, pret } = useIdentity();

  const cible = moduleForPath(pathname ?? "");
  // Tant que l'identité n'est pas résolue, on ne tranche pas : conclure « aucun
  // droit » sur une identité encore vide renverrait vers /acces-refuse
  // quelqu'un qui a le droit d'entrer.
  const autorise = !pret || cible === null || peutVoirModule(identite, cible);
  const repli = routeDeRepli(identite);

  useEffect(() => {
    if (!autorise) router.replace(repli);
  }, [autorise, repli, router]);

  if (!pret) {
    return <p className="py-24 text-center text-sm text-muted">Chargement…</p>;
  }

  if (!autorise) {
    return (
      <p className="py-24 text-center text-sm text-muted">
        Accès non autorisé — redirection…
      </p>
    );
  }
  return <>{children}</>;
}
