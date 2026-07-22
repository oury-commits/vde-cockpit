"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Coins,
  History,
  MailPlus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import {
  ROLE_LABEL,
  estInviteEnAttente,
  type AccessLogEntry,
  type EntiteAcces,
  type Profile,
  type Role,
} from "@/lib/roles/types";
import { overridesEffectifs, raisonMontants } from "@/lib/roles/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ProfilEditor } from "@/components/equipe/ProfilEditor";
import { AddMembreDialog } from "@/components/equipe/AddMembreDialog";

const ENTITE_LABEL: Record<string, string> = {
  FR: "France",
  MA: "Maroc",
  ALL: "France + Maroc",
};

// Badges couleur (palette brand VDE).
const ROLE_TONE: Record<Role, string> = {
  admin: "bg-gold/20 text-gold-ink",
  charge_affaires: "bg-brand/10 text-brand",
  assistante: "bg-success/12 text-success",
  conducteur_travaux: "bg-muted/15 text-muted",
  technicien: "bg-muted/15 text-muted",
};
const ENTITE_TONE: Record<string, string> = {
  FR: "bg-brand/10 text-brand",
  MA: "bg-gold/20 text-gold-ink",
  ALL: "bg-ink/10 text-ink",
};

const ACTION_LABEL: Record<AccessLogEntry["action"], string> = {
  creation: "Invitation",
  role: "Rôle",
  entite: "Entité",
  override: "Dérogation",
  activation: "Activation",
  suppression: "Suppression",
};

function initiales(nom: string): string {
  // On ignore les suffixes entre parenthèses (« Nadia (démo) » → « N »).
  const mots = nom.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  return (mots[0][0] + (mots[1]?.[0] ?? "")).toUpperCase();
}

function Pastille({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {children}
    </span>
  );
}

function LigneProfil({
  profil,
  moi,
  dernierAdmin,
  onEditer,
  onToggleActif,
  onRenvoyer,
  onSupprimer,
}: {
  profil: Profile;
  moi: boolean;
  dernierAdmin: boolean;
  onEditer: () => void;
  onToggleActif: () => void;
  onRenvoyer: () => void;
  onSupprimer: () => void;
}) {
  const derogations = overridesEffectifs(profil.role, profil.overrides);
  const enAttente = estInviteEnAttente(profil);

  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 lg:flex-row lg:items-center lg:gap-4">
      {/* Identité */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
            profil.actif ? "bg-brand/10 text-brand" : "bg-line text-muted",
          )}
        >
          {initiales(profil.nom || profil.email)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{profil.nom}</span>
            {moi ? <Badge tone="gold">vous</Badge> : null}
            {profil.demo ? <Badge tone="muted">compte de test</Badge> : null}
          </div>
          <p className="truncate text-[12px] text-muted">{profil.email}</p>
          {profil.telephone ? (
            <p className="font-mono text-[11px] text-muted">{profil.telephone}</p>
          ) : null}
        </div>
      </div>

      {/* Rôle · entité · dérogations */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {profil.role ? (
          <Pastille tone={ROLE_TONE[profil.role]}>{ROLE_LABEL[profil.role]}</Pastille>
        ) : (
          <Pastille tone="bg-alert/10 text-alert">Non assigné</Pastille>
        )}
        {profil.entite ? (
          <Pastille tone={ENTITE_TONE[profil.entite]}>{profil.entite}</Pastille>
        ) : null}
        {derogations.length > 0 ? (
          <Pastille tone="bg-gold/20 text-gold-ink">
            <SlidersHorizontal className="mr-1 size-3" strokeWidth={2} />
            personnalisé · {derogations.length}
          </Pastille>
        ) : null}
      </div>

      {/* Statut + dernière connexion */}
      <div className="flex items-center gap-2 text-[12px] lg:w-40">
        {!profil.actif ? (
          <Badge tone="alert">inactif</Badge>
        ) : enAttente ? (
          <Badge tone="gold">en attente</Badge>
        ) : (
          <Badge tone="success">actif</Badge>
        )}
        <span className="font-mono text-muted">
          {profil.derniere_connexion ? formatDate(profil.derniere_connexion) : "—"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="secondary" size="sm" onClick={onEditer}>
          Modifier
        </Button>
        {enAttente ? (
          <button
            type="button"
            onClick={onRenvoyer}
            title="Renvoyer l'invitation"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-brand"
          >
            <MailPlus className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleActif}
          disabled={dernierAdmin && profil.actif}
          title={
            dernierAdmin && profil.actif
              ? "Dernier administrateur actif — non désactivable"
              : profil.actif
                ? "Désactiver (coupe l'accès, garde l'historique)"
                : "Réactiver"
          }
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          {profil.actif ? <Ban className="size-4" strokeWidth={1.75} /> : <RotateCcw className="size-4" strokeWidth={1.75} />}
        </button>
        {profil.demo ? (
          <button
            type="button"
            onClick={onSupprimer}
            title="Supprimer ce compte de test"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-alert/10 hover:text-alert"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatCase({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function EquipeScreen() {
  const store = useProfiles();
  const { profiles, journal, loaded } = store;
  const { identite } = useIdentity();
  const auteur = identite.nom;

  const [editeId, setEditeId] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [journalOuvert, setJournalOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [fRole, setFRole] = useState<Role | "">("");
  const [fEntite, setFEntite] = useState<EntiteAcces | "">("");
  const [fStatut, setFStatut] = useState<"" | "actif" | "inactif" | "attente">("");
  const [confirm, setConfirm] = useState<
    | { titre: string; message: string; danger: boolean; action: () => void }
    | null
  >(null);

  const edite = profiles.find((p) => p.id === editeId) ?? null;

  // ── Récap pilotage ──
  const actifs = profiles.filter((p) => p.actif);
  const parRole = useMemo(() => {
    const m = new Map<Role, number>();
    for (const p of actifs) if (p.role) m.set(p.role, (m.get(p.role) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [actifs]);
  const voientMontants = useMemo(
    () => actifs.filter((p) => raisonMontants(p.role, p.overrides).voit),
    [actifs],
  );
  const enAttente = useMemo(() => profiles.filter(estInviteEnAttente), [profiles]);
  const nbDemo = profiles.filter((p) => p.demo).length;

  // ── Recherche + filtres ──
  const membres = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return profiles.filter((p) => {
      if (needle) {
        const hay = `${p.nom} ${p.email} ${p.telephone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fRole && p.role !== fRole) return false;
      if (fEntite && p.entite !== fEntite) return false;
      if (fStatut === "actif" && (!p.actif || estInviteEnAttente(p))) return false;
      if (fStatut === "inactif" && p.actif) return false;
      if (fStatut === "attente" && !estInviteEnAttente(p)) return false;
      return true;
    });
  }, [profiles, q, fRole, fEntite, fStatut]);

  const ligne = (p: Profile) => (
    <LigneProfil
      key={p.id}
      profil={p}
      moi={identite.id === p.id}
      dernierAdmin={store.estDernierAdminActif(p.id)}
      onEditer={() => setEditeId(p.id)}
      onToggleActif={() => {
        if (p.actif) {
          setConfirm({
            titre: `Désactiver ${p.nom}`,
            message:
              "L'accès est coupé immédiatement. L'historique et les pièces sont conservés — ce n'est pas une suppression.",
            danger: false,
            action: () => store.setActifProfile(p.id, false, auteur),
          });
        } else {
          store.setActifProfile(p.id, true, auteur);
        }
      }}
      onRenvoyer={() => store.renvoyerInvitation(p.id, auteur)}
      onSupprimer={() =>
        setConfirm({
          titre: `Supprimer ${p.nom}`,
          message:
            "Compte de test — suppression définitive. (Un vrai membre se désactive, il ne se supprime pas.)",
          danger: true,
          action: () => store.deleteProfile(p.id, auteur),
        })
      }
    />
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle>Équipe &amp; accès</PageTitle>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Le rôle décide de ce qu&apos;on fait, l&apos;entité décide de où. Un
            membre se <span className="font-semibold text-ink">désactive</span>{" "}
            (accès coupé, historique gardé) — on ne supprime que les comptes de
            test.
          </p>
        </div>
        <Button icon={UserPlus} onClick={() => setAjout(true)} className="shrink-0">
          Inviter un membre
        </Button>
      </div>

      {/* Récap pilotage */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCase
          label="Membres actifs"
          value={String(actifs.length)}
          hint={parRole.map(([r, n]) => `${n} ${ROLE_LABEL[r].toLowerCase()}`).join(" · ") || "—"}
        />
        <StatCase
          label="Voient les montants"
          value={String(voientMontants.length)}
          hint={
            voientMontants.length
              ? voientMontants.map((p) => p.nom.split(" ")[0]).join(", ")
              : "personne"
          }
        />
        <StatCase
          label="Invitations en attente"
          value={String(enAttente.length)}
          hint={enAttente.length ? "pas encore connecté(s)" : "aucune"}
        />
      </div>

      {/* Accès sensibles — qui accède à l'argent */}
      {voientMontants.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gold-ink">
            <Coins className="size-4" strokeWidth={2} />
            Accès montants &amp; marges :
          </span>
          {voientMontants.map((p) => {
            const par = raisonMontants(p.role, p.overrides).par;
            return (
              <span key={p.id} className="inline-flex items-center gap-1 text-[13px] text-gold-ink">
                <span className="font-semibold">{p.nom}</span>
                <span className="text-gold-ink/70">
                  ({par === "derogation" ? "dérogation" : p.role ? ROLE_LABEL[p.role] : "—"})
                </span>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Invitations en attente — section distincte */}
      {enAttente.length > 0 ? (
        <Card className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <MailPlus className="size-4 text-gold-ink" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-ink">
              Invitations en attente ({enAttente.length})
            </h3>
          </div>
          <ul className="divide-y divide-line">
            {enAttente.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                <span className="font-semibold text-ink">{p.nom}</span>
                <span className="text-muted">{p.email}</span>
                {p.role ? <Pastille tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Pastille> : null}
                <span className="ml-auto font-mono text-[12px] text-muted">
                  invité le {p.invite_le ? formatDate(p.invite_le) : "—"}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={MailPlus}
                  onClick={() => store.renvoyerInvitation(p.id, auteur)}
                >
                  Renvoyer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Sécurité serveur + purge démo */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3">
        <p className="flex items-start gap-2.5 text-[13px] text-ink">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} />
          Droits doublés par la sécurité serveur (RLS) : un accès retiré ici l&apos;est
          aussi en base.
        </p>
        {nbDemo > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            onClick={() =>
              setConfirm({
                titre: "Purger les comptes de démo",
                message: `Supprimer définitivement les ${nbDemo} comptes de test ? Les vrais membres ne sont pas touchés — nettoyage avant mise en production.`,
                danger: true,
                action: () => store.purgeDemoProfiles(auteur),
              })
            }
          >
            Purger la démo ({nbDemo})
          </Button>
        ) : null}
      </div>

      {/* Recherche + filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un membre…"
            className="pl-9"
          />
        </div>
        <Select value={fRole} onChange={(e) => setFRole(e.target.value as Role | "")} className="w-auto">
          <option value="">Tous les rôles</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </Select>
        <Select value={fEntite} onChange={(e) => setFEntite(e.target.value as EntiteAcces | "")} className="w-auto">
          <option value="">Toutes entités</option>
          <option value="FR">France</option>
          <option value="MA">Maroc</option>
          <option value="ALL">France + Maroc</option>
        </Select>
        <Select value={fStatut} onChange={(e) => setFStatut(e.target.value as typeof fStatut)} className="w-auto">
          <option value="">Tous statuts</option>
          <option value="actif">Actifs</option>
          <option value="attente">En attente</option>
          <option value="inactif">Inactifs</option>
        </Select>
      </div>

      {/* Liste membres */}
      <Card className="mt-3 p-0">
        {!loaded ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Chargement…</p>
        ) : membres.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {profiles.length === 0
              ? "Aucun membre — invite ton équipe pour commencer."
              : "Aucun membre ne correspond à ces filtres."}
          </p>
        ) : (
          membres.map(ligne)
        )}
      </Card>

      {/* Journal des accès */}
      <Card className="mt-4">
        <button
          type="button"
          onClick={() => setJournalOuvert((v) => !v)}
          className="flex w-full items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <History className="size-4 text-muted" strokeWidth={2} />
            Journal des accès
            <span className="font-mono text-[12px] font-normal text-muted">{journal.length}</span>
          </span>
          <span className="text-[13px] text-muted">{journalOuvert ? "Masquer" : "Afficher"}</span>
        </button>
        {journalOuvert ? (
          journal.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">Aucune entrée pour l&apos;instant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {journal.slice(0, 100).map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-[13px]">
                  <Badge tone={e.action === "suppression" ? "alert" : "muted"}>{ACTION_LABEL[e.action]}</Badge>
                  <span className="font-semibold text-ink">{e.cible}</span>
                  <span className="text-muted">{e.detail}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted">
                    {e.auteur} · {formatDate(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      {edite ? <ProfilEditor profil={edite} onClose={() => setEditeId(null)} /> : null}
      {ajout ? <AddMembreDialog auteur={auteur} onClose={() => setAjout(false)} /> : null}
      {confirm ? (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm.titre}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>Annuler</Button>
              <Button
                variant={confirm.danger ? "danger" : "primary"}
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                Confirmer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">{confirm.message}</p>
        </Modal>
      ) : null}
    </div>
  );
}
