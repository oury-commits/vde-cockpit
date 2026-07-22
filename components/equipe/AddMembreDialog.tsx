"use client";

import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useProfiles, profilesRepoKind } from "@/lib/roles/ProfilesProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABEL, type EntiteAcces, type Role } from "@/lib/roles/types";

const ROLES: Role[] = [
  "admin",
  "charge_affaires",
  "conducteur_travaux",
  "technicien",
  "assistante",
];

export function AddMembreDialog({
  auteur,
  onClose,
}: {
  auteur: string;
  onClose: () => void;
}) {
  const { addProfile } = useProfiles();
  const { session } = useAuth();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [entite, setEntite] = useState<EntiteAcces | "">("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const supabase = profilesRepoKind === "supabase";
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const peutCreer = nom.trim().length > 0 && emailValide && !busy;
  // Deny par défaut : sans rôle/entité, le membre est créé mais n'accède à rien.
  const denyDefaut = !role || !entite;

  async function creer() {
    if (!peutCreer) return;
    setErreur(null);
    setBusy(true);
    try {
      const input = {
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim() || null,
        role: (role || null) as Role | null,
        entite: (entite || null) as EntiteAcces | null,
      };
      if (supabase) {
        // Backend réel : l'utilisateur Auth doit exister AVANT la ligne profiles
        // (clé étrangère profiles.id → auth.users). La création passe donc par
        // une route serveur qui invite + crée le profil avec le même uuid.
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(session?.access_token
              ? { authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Échec (${res.status}).`);
        }
        // La liste se rafraîchira au prochain chargement ; on ferme.
        onClose();
        return;
      }
      addProfile(input, auteur);
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Inviter un membre"
      description="Le membre reçoit une invitation ; sans rôle ni entité, il n'accède à rien."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={creer} disabled={!peutCreer}>
            {busy ? "Création…" : supabase ? "Inviter le membre" : "Créer le membre"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom">
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" autoFocus />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@visiondigitalenergies.fr"
          />
        </Field>
        <Field label="Téléphone">
          <Input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
          />
        </Field>
        <Field label="Rôle">
          <Select
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role | "";
              setRole(r);
              if (r !== "admin" && entite === "ALL") setEntite("");
            }}
          >
            <option value="">Non assigné (aucun accès)</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entité">
          <Select value={entite} onChange={(e) => setEntite(e.target.value as EntiteAcces | "")}>
            <option value="">Aucune entité (aucun accès)</option>
            <option value="FR">France</option>
            <option value="MA">Maroc</option>
            {role === "admin" ? <option value="ALL">France + Maroc (admin)</option> : null}
          </Select>
        </Field>
      </div>

      {denyDefaut ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-cream/50 px-3 py-2 text-[13px] text-muted">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          Rôle ou entité non fixé : le membre sera créé « non assigné » — aucun
          accès tant que tu ne les renseignes pas (deny par défaut).
        </p>
      ) : null}

      {supabase ? (
        <p className="mt-2 text-[12px] text-muted">
          Une invitation Supabase Auth est envoyée à cet email ; la ligne
          d&apos;accès est créée avec le même identifiant.
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-muted">
          Mode démo local : le membre est créé sans envoi d&apos;email.
        </p>
      )}

      {erreur ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2 text-[13px] text-alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {erreur}
        </p>
      ) : null}
    </Modal>
  );
}
