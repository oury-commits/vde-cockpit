"use client";

import { FlaskConical } from "lucide-react";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { ROLE_LABEL, type EntiteAcces, type Role } from "@/lib/roles/types";

const ROLES: (Role | "")[] = [
  "admin",
  "charge_affaires",
  "conducteur_travaux",
  "technicien",
  "assistante",
  "", // non assigné → deny by default
];

/**
 * Sélecteur DE CONSTRUCTION uniquement : simule (rôle × entité) sans login,
 * à côté du toggle FR/MA (qui reste le comportement admin réel).
 * TODO P3 : supprimer ce composant à l'activation de l'auth — l'identité
 * viendra alors de `profiles`.
 */
export function DevIdentityBar() {
  const { identite, simulation, setRole, setEntite, setActif } = useIdentity();
  if (!simulation) return null;

  const adminSelect = identite.role === "admin";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gold/30 bg-gold/10 px-4 py-1.5 text-[12px] text-gold-ink">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" strokeWidth={2} />
        Simulation
      </span>

      <label className="flex items-center gap-1.5">
        <span className="text-muted">Rôle</span>
        <select
          aria-label="Rôle simulé"
          value={identite.role ?? ""}
          onChange={(e) => setRole((e.target.value || null) as Role | null)}
          className="h-7 rounded-md border border-gold/40 bg-surface px-2 text-[12px] text-ink"
        >
          {ROLES.map((r) => (
            <option key={r || "none"} value={r}>
              {r ? ROLE_LABEL[r] : "Non assigné"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-muted">Entité</span>
        <select
          aria-label="Entité simulée"
          value={identite.entite ?? ""}
          onChange={(e) => setEntite((e.target.value || null) as EntiteAcces | null)}
          className="h-7 rounded-md border border-gold/40 bg-surface px-2 text-[12px] text-ink disabled:opacity-50"
        >
          <option value="FR">France</option>
          <option value="MA">Maroc</option>
          {/* « Tous » réservé à l'admin */}
          {adminSelect ? <option value="ALL">Tous (admin)</option> : null}
          <option value="">Non assignée</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          className="size-3.5 accent-brand"
          checked={identite.actif}
          onChange={(e) => setActif(e.target.checked)}
        />
        <span>Compte actif</span>
      </label>

      <span className="ml-auto text-muted">
        vu comme <span className="font-semibold text-gold-ink">{identite.nom}</span>
      </span>
    </div>
  );
}
