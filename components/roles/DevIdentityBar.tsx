"use client";

import { FlaskConical } from "lucide-react";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { ROLE_LABEL, type EntiteAcces, type Role } from "@/lib/roles/types";
import { overridesEffectifs } from "@/lib/roles/permissions";

const ROLES: (Role | "")[] = [
  "admin",
  "charge_affaires",
  "conducteur_travaux",
  "technicien",
  "assistante",
  "", // non assigné → deny by default
];

/**
 * Sélecteur DE CONSTRUCTION uniquement : simule une identité sans login.
 * « Incarner » suit un profil réel de l'équipe (dérogations comprises) ;
 * les trois curseurs servent à balayer une combinaison libre.
 * TODO P3 : supprimer ce composant à l'activation de l'auth — l'identité
 * viendra alors de `profiles`.
 */
export function DevIdentityBar() {
  const { identite, simulation, profilId, incarner, setRole, setEntite, setActif } =
    useIdentity();
  const { profiles } = useProfiles();
  if (!simulation) return null;

  const incarne = profilId !== null;
  const adminSelect = identite.role === "admin";
  const derogations = overridesEffectifs(identite.role, identite.overrides);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gold/30 bg-gold/10 px-4 py-1.5 text-[12px] text-gold-ink">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" strokeWidth={2} />
        Simulation
      </span>

      <label className="flex items-center gap-1.5">
        <span className="text-muted">Incarner</span>
        <select
          aria-label="Membre incarné"
          value={profilId ?? ""}
          onChange={(e) => incarner(e.target.value || null)}
          className="h-7 rounded-md border border-gold/40 bg-surface px-2 text-[12px] text-ink"
        >
          <option value="">Identité libre</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>

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

      <span className="ml-auto flex items-center gap-2 text-muted">
        {derogations.length > 0 ? (
          <span className="rounded-full border border-gold/50 bg-gold/20 px-2 py-0.5 font-semibold text-gold-ink">
            personnalisé · <span className="font-mono">{derogations.length}</span>
          </span>
        ) : null}
        <span>
          {incarne ? "incarne" : "vu comme"}{" "}
          <span className="font-semibold text-gold-ink">{identite.nom}</span>
        </span>
      </span>
    </div>
  );
}
