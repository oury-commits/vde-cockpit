"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Mail, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { useModeles } from "@/lib/emails/ModelesProvider";
import { preparerModele, type ContexteModele } from "@/lib/emails/variables";
import { TAGS, type ModeleEmail } from "@/lib/emails/types";
import { uid } from "@/lib/uid";
import type { Lead } from "@/lib/types";

const DECLENCHEURS: { value: string; label: string }[] = [
  { value: "", label: "Aucun (toujours dispo)" },
  { value: "a_qualifier", label: "Lead à qualifier" },
  { value: "devis_envoye", label: "Devis envoyé" },
  { value: "signe", label: "Devis signé / validé" },
  { value: "acompte", label: "Acompte encaissé" },
  { value: "planifie", label: "RDV confirmé" },
  { value: "installe", label: "Installé" },
  { value: "solde", label: "Soldé" },
];
const declLabel = (v: string | null) =>
  DECLENCHEURS.find((d) => d.value === (v ?? ""))?.label ?? v ?? "—";

// Dossier fictif pour l'aperçu (aucune donnée réelle).
const LEAD_FICTIF = {
  id: "FB-000",
  entite: "FR",
  nom: "Dupont Martin",
  telephone: "06 12 34 56 78",
  email: "client@example.test",
  adresse: "12 rue des Lilas",
  code_postal: "69003",
  ville: "Lyon",
  statut: "devis_envoye",
  devis: {
    ref: "VDE-2026-042",
    devise: "EUR",
    date_creation: "2026-07-01T10:00:00.000Z",
    montant_ttc: 1785,
  },
  rdv: {
    debut: "2026-07-24T07:00:00.000Z",
    fin: "2026-07-24T09:00:00.000Z",
    type: "pose",
    technicien_nom: "Julien",
  },
  reglements: [],
} as unknown as Lead;

function blank(): ModeleEmail {
  return {
    id: `MEL-${uid()}`,
    cle: "",
    entite: "FR",
    declencheur: null,
    nom: "",
    objet: "",
    corps: "",
    canal: "email",
    actif: true,
    ordre: 500,
    version: 0,
    modifie_par: null,
    updated_at: new Date().toISOString(),
  };
}

export function ModelesEmail() {
  const { identite } = useIdentity();
  const { modeles, save, duplicate, remove } = useModeles();
  const estAdmin = identite.role === "admin";

  const [form, setForm] = useState<ModeleEmail | null>(null);
  const [estNouveau, setEstNouveau] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmSuppr, setConfirmSuppr] = useState<string | null>(null);
  const corpsRef = useRef<HTMLTextAreaElement>(null);

  const liste = useMemo(() => [...modeles].sort((a, b) => a.ordre - b.ordre), [modeles]);

  const apercu = useMemo(() => {
    if (!form) return null;
    const ctx: ContexteModele = {
      lead: LEAD_FICTIF,
      expediteur: { nom: identite.nom || "Oury", telephone: "06 00 00 00 00" },
      fiche: {
        raison_sociale: "Vision Digital Energies",
        lien_avis: "https://g.page/r/vde/review",
      } as ContexteModele["fiche"],
    };
    return preparerModele(form.objet, form.corps, ctx);
  }, [form, identite.nom]);

  if (!estAdmin) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Mail className="size-4 text-brand" strokeWidth={1.75} />
          Modèles d&apos;emails
        </h3>
        <p className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Réservé à l&apos;administrateur. Les modèles sont utilisables depuis la
          fiche lead (« Écrire / Relancer »).
        </p>
      </section>
    );
  }

  const ouvrir = (m: ModeleEmail) => {
    setForm({ ...m });
    setEstNouveau(false);
    setErreur(null);
  };
  const nouveau = () => {
    setForm(blank());
    setEstNouveau(true);
    setErreur(null);
  };

  const insererTag = (tag: string) => {
    setForm((f) => {
      if (!f) return f;
      const ta = corpsRef.current;
      if (!ta) return { ...f, corps: `${f.corps}${tag}` };
      const s = ta.selectionStart ?? f.corps.length;
      const e = ta.selectionEnd ?? f.corps.length;
      const corps = f.corps.slice(0, s) + tag + f.corps.slice(e);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(s + tag.length, s + tag.length);
      });
      return { ...f, corps };
    });
  };

  const enregistrer = async () => {
    if (!form) return;
    if (!form.nom.trim() || !form.cle.trim() || !form.objet.trim()) {
      setErreur("Nom, clé et objet sont obligatoires.");
      return;
    }
    setBusy(true);
    setErreur(null);
    const res = await save(form, estNouveau);
    setBusy(false);
    if (res.ok) {
      setForm(null);
    } else {
      setErreur(res.conflit ? "Modèle modifié entre-temps — ferme et rouvre pour repartir de la dernière version." : res.error);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Mail className="size-4 text-brand" strokeWidth={1.75} />
          Modèles d&apos;emails
        </h3>
        <Button size="sm" icon={Plus} onClick={nouveau}>
          Nouveau
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Relances &amp; cycle de vie, modifiables. Utilisés depuis la fiche lead.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        {liste.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm text-ink">{m.nom}</span>
                {!m.actif ? <Badge tone="muted">inactif</Badge> : null}
                {m.entite !== "FR" ? <Badge tone="gold">{m.entite}</Badge> : null}
              </span>
              <span className="block truncate text-[12px] text-muted">
                {declLabel(m.declencheur)} · {m.objet}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => ouvrir(m)} aria-label="Éditer" />
              <Button size="sm" variant="ghost" icon={Copy} onClick={() => void duplicate(m.id)} aria-label="Dupliquer" />
              <Button
                size="sm"
                variant="ghost"
                icon={Power}
                onClick={() => void save({ ...m, actif: !m.actif }, false)}
                aria-label={m.actif ? "Désactiver" : "Activer"}
              />
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmSuppr(m.id)} aria-label="Supprimer" />
            </div>
          </div>
        ))}
      </div>

      {/* Éditeur */}
      {form ? (
        <Modal
          open
          onClose={() => setForm(null)}
          title={estNouveau ? "Nouveau modèle" : "Modifier le modèle"}
          size="xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setForm(null)}>
                Annuler
              </Button>
              <Button onClick={enregistrer} disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nom">
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
            <Field label="Clé (unique par entité)">
              <Input className="font-mono" value={form.cle} onChange={(e) => setForm({ ...form, cle: e.target.value })} />
            </Field>
            <Field label="Entité">
              <Select value={form.entite} onChange={(e) => setForm({ ...form, entite: e.target.value })}>
                <option value="FR">France</option>
                <option value="MA">Maroc</option>
                <option value="ALL">Les deux</option>
              </Select>
            </Field>
            <Field label="Déclencheur (suggestion)">
              <Select
                value={form.declencheur ?? ""}
                onChange={(e) => setForm({ ...form, declencheur: e.target.value || null })}
              >
                {DECLENCHEURS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as "email" | "sms" })}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            <Field label="Actif">
              <label className="flex h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={form.actif}
                  onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                />
                Proposé sur la fiche lead
              </label>
            </Field>
          </div>

          <Field label="Objet" className="mt-3">
            <Input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
          </Field>

          <div className="mt-3">
            <Field label="Corps">
              <Textarea
                ref={corpsRef}
                rows={7}
                value={form.corps}
                onChange={(e) => setForm({ ...form, corps: e.target.value })}
                className="leading-relaxed"
              />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => insererTag(t.tag)}
                  title={t.libelle}
                  className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-brand transition-colors hover:bg-cream"
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>

          {apercu ? (
            <div className="mt-4 rounded-xl border border-line bg-cream/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Aperçu (dossier fictif)
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{apercu.objet}</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">{apercu.corps}</p>
              {apercu.manquantes.length > 0 ? (
                <p className="mt-2 font-mono text-[11px] text-gold-ink">
                  À compléter : {apercu.manquantes.map((t) => `{{${t}}}`).join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {erreur ? <p className="mt-3 text-[13px] text-alert">{erreur}</p> : null}
        </Modal>
      ) : null}

      {/* Confirmation de suppression */}
      {confirmSuppr ? (
        <Modal
          open
          onClose={() => setConfirmSuppr(null)}
          title="Supprimer le modèle"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmSuppr(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await remove(confirmSuppr);
                  setConfirmSuppr(null);
                }}
              >
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            Ce modèle sera supprimé définitivement. Pour le garder mais ne plus le
            proposer, désactive-le plutôt.
          </p>
        </Modal>
      ) : null}
    </section>
  );
}
