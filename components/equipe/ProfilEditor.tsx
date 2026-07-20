"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Lock, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import {
  ROLE_LABEL,
  type Acces,
  type EntiteAcces,
  type OverrideKey,
  type Overrides,
  type Profile,
  type Role,
} from "@/lib/roles/types";
import {
  MODULE_LABEL,
  OVERRIDE_KEYS,
  accesDuRole,
  confirmationRequise,
  estSensible,
  overridesEffectifs,
} from "@/lib/roles/permissions";
import { formatDate } from "@/lib/format";

const ROLES: Role[] = [
  "admin",
  "charge_affaires",
  "conducteur_travaux",
  "technicien",
  "assistante",
];

const ACCES_LABEL: Record<Acces, string> = {
  full: "Accès complet",
  read: "Lecture seule",
  partial: "Partiel",
  none: "Aucun accès",
};

/** Ce que le rôle prévoit pour cette clé, en clair. */
function defautDuRole(cle: OverrideKey, role: Role | null): string {
  if (cle === "montants") {
    const voit = !!role && role !== "conducteur_travaux" && role !== "technicien";
    return voit ? "Accès complet" : "Aucun accès";
  }
  return ACCES_LABEL[accesDuRole(role, cle)];
}

interface Confirmation {
  cle: OverrideKey;
  acces: Acces;
  message: string;
}

export function ProfilEditor({
  profil,
  onClose,
}: {
  profil: Profile;
  onClose: () => void;
}) {
  const { profiles, updateProfile } = useProfiles();
  const { identite } = useIdentity();

  const [role, setRole] = useState<Role | null>(profil.role);
  const [entite, setEntite] = useState<EntiteAcces | null>(profil.entite);
  const [actif, setActif] = useState(profil.actif);
  const [overrides, setOverrides] = useState<Overrides>(profil.overrides ?? {});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Invariant : il reste toujours au moins un administrateur actif. Sans lui,
  // plus personne ne peut redistribuer les droits — l'équipe est ingérable.
  const dernierAdmin = useMemo(() => {
    const admins = profiles.filter((p) => p.role === "admin" && p.actif);
    return admins.length === 1 && admins[0].id === profil.id;
  }, [profiles, profil.id]);

  const derogations = overridesEffectifs(role, overrides);

  function appliquer(cle: OverrideKey, valeur: string) {
    if (valeur === "") {
      // « Selon le rôle » : on retire la dérogation au lieu de figer la valeur
      // courante, sinon un changement de rôle ultérieur serait sans effet.
      const next = { ...overrides };
      delete next[cle];
      setOverrides(next);
      return;
    }
    const acces = valeur as Acces;
    const message = confirmationRequise(cle, acces, role);
    if (message) {
      setConfirmation({ cle, acces, message });
      return;
    }
    setOverrides({ ...overrides, [cle]: acces });
  }

  function confirmer() {
    if (!confirmation) return;
    setOverrides({ ...overrides, [confirmation.cle]: confirmation.acces });
    setConfirmation(null);
  }

  function enregistrer() {
    updateProfile(
      profil.id,
      {
        role,
        // `ALL` est réservé à l'admin : un changement de rôle le retire.
        entite: role === "admin" ? entite : entite === "ALL" ? "FR" : entite,
        actif,
        overrides,
      },
      identite.nom,
    );
    onClose();
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={profil.nom}
        description={profil.email}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={enregistrer}>Enregistrer</Button>
          </>
        }
      >
        {dernierAdmin ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-gold-ink" strokeWidth={2} />
            <p className="text-[13px] text-gold-ink">
              Dernier administrateur actif : son rôle et son activation sont
              verrouillés. Nommez un autre administrateur avant de les changer.
            </p>
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Rôle
            </span>
            <select
              aria-label="Rôle"
              disabled={dernierAdmin}
              value={role ?? ""}
              onChange={(e) => {
                const r = (e.target.value || null) as Role | null;
                setRole(r);
                if (r !== "admin" && entite === "ALL") setEntite("FR");
              }}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink disabled:bg-cream disabled:text-muted"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
              <option value="">Non assigné (aucun accès)</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Entité
            </span>
            <select
              aria-label="Entité"
              value={entite ?? ""}
              onChange={(e) => setEntite((e.target.value || null) as EntiteAcces | null)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink"
            >
              <option value="FR">France</option>
              <option value="MA">Maroc</option>
              {role === "admin" ? (
                <option value="ALL">France + Maroc (admin)</option>
              ) : null}
              <option value="">Aucune entité (aucun accès)</option>
            </select>
          </label>
        </section>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-brand"
            disabled={dernierAdmin}
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
          />
          Compte actif
          <span className="text-muted">
            — désactivé, il ne peut plus rien ouvrir, dérogations comprises.
          </span>
        </label>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Dérogations ponctuelles
            </h4>
            {derogations.length > 0 ? (
              <Badge tone="gold">
                personnalisé · <span className="font-mono">{derogations.length}</span>
              </Badge>
            ) : null}
          </div>
          <p className="mb-3 text-[13px] text-muted">
            À utiliser pour un cas précis, pas pour contourner un rôle. Chaque
            écart au rôle est signalé — ici comme dans la liste de l&apos;équipe.
          </p>

          <div className="divide-y divide-line rounded-xl border border-line">
            {OVERRIDE_KEYS.map((cle) => {
              const valeur = overrides[cle];
              const perso = derogations.includes(cle);
              return (
                <div
                  key={cle}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-medium text-ink">
                        {MODULE_LABEL[cle]}
                      </span>
                      {estSensible(cle) ? (
                        <AlertTriangle
                          className="size-3.5 text-gold-ink"
                          strokeWidth={2}
                          aria-label="Accès sensible"
                        />
                      ) : null}
                      {perso ? <Badge tone="gold">personnalisé</Badge> : null}
                    </div>
                    <p className="text-[12px] text-muted">
                      Par le rôle : {defautDuRole(cle, role)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Accès ${MODULE_LABEL[cle]}`}
                      value={valeur ?? ""}
                      onChange={(e) => appliquer(cle, e.target.value)}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"
                    >
                      <option value="">Selon le rôle</option>
                      <option value="none">Aucun accès</option>
                      <option value="read">Lecture seule</option>
                      <option value="full">Accès complet</option>
                    </select>
                    {valeur ? (
                      <button
                        type="button"
                        aria-label={`Rétablir le rôle pour ${MODULE_LABEL[cle]}`}
                        onClick={() => appliquer(cle, "")}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {profil.modifie_le ? (
          <p className="mt-4 text-[12px] text-muted">
            Droits modifiés par {profil.modifie_par ?? "—"} le{" "}
            <span className="font-mono">{formatDate(profil.modifie_le)}</span>
          </p>
        ) : null}
      </Modal>

      {confirmation ? (
        <Modal
          open
          onClose={() => setConfirmation(null)}
          title="Confirmer cet accès"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                Annuler
              </Button>
              <Button onClick={confirmer}>Accorder l&apos;accès</Button>
            </>
          }
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-alert"
              strokeWidth={2}
            />
            <div className="text-sm text-ink">
              <p className="font-medium">
                {MODULE_LABEL[confirmation.cle]} — {ACCES_LABEL[confirmation.acces]}{" "}
                pour {profil.nom}
              </p>
              <p className="mt-1.5 text-muted">{confirmation.message}</p>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
