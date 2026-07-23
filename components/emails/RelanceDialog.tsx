"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCopy,
  History,
  Send,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { Lead } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import { useModeles } from "@/lib/emails/ModelesProvider";
import { declencheurActif, preparerModele, type ContexteModele } from "@/lib/emails/variables";
import { expediteur } from "@/lib/documents/email";
import type { ModeleEmail } from "@/lib/emails/types";

export function RelanceDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const store = useLeadsStore();
  const { identite } = useIdentity();
  const { profilById } = useProfiles();
  const { fiche } = useEntreprise();
  const { modeles } = useModeles();

  const [choisi, setChoisi] = useState<ModeleEmail | null>(null);
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  const [manquantes, setManquantes] = useState<string[]>([]);
  const [copie, setCopie] = useState(false);
  const [journalise, setJournalise] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [smtp, setSmtp] = useState<boolean | null>(null);

  // Disponibilité de l'envoi automatique (Resend).
  useEffect(() => {
    fetch("/api/send-devis")
      .then((r) => r.json())
      .then((d) => setSmtp(Boolean(d?.configured)))
      .catch(() => setSmtp(false));
  }, []);

  const ctx: ContexteModele = useMemo(
    () => ({
      lead,
      expediteur: {
        nom: identite.nom,
        telephone: profilById(identite.id)?.telephone ?? null,
      },
      fiche: fiche(lead.entite),
    }),
    [lead, identite.nom, identite.id, profilById, fiche],
  );

  // Modèles de l'entité, actifs — suggérés (déclencheur pertinent) d'abord.
  const liste = useMemo(() => {
    const dispo = modeles.filter(
      (m) => m.actif && m.canal === "email" && (m.entite === lead.entite || m.entite === "ALL"),
    );
    const score = (m: ModeleEmail) => (declencheurActif(m.declencheur, lead) ? 0 : 1);
    return [...dispo].sort((a, b) => score(a) - score(b) || a.ordre - b.ordre);
  }, [modeles, lead]);

  const selectModele = (m: ModeleEmail) => {
    const p = preparerModele(m.objet, m.corps, ctx);
    setChoisi(m);
    setObjet(p.objet);
    setCorps(p.corps);
    setManquantes(p.manquantes);
    setCopie(false);
    setJournalise(false);
    setMsg(null);
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`${objet}\n\n${corps}`);
      setCopie(true);
    } catch {
      setMsg("Copie impossible — sélectionne le texte manuellement.");
    }
  };

  const journaliser = () => {
    if (!choisi || journalise) return;
    store.addActivite(lead.id, "email", `Email « ${choisi.nom} » envoyé au client`);
    setJournalise(true);
  };

  const envoyerCrm = async () => {
    if (!choisi || !lead.email || envoi) return;
    setEnvoi(true);
    setMsg(null);
    try {
      const res = await fetch("/api/send-devis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          sujet: objet,
          texte: corps,
          from: expediteur(lead.entite),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Envoi impossible.");
      journaliser();
      setMsg("Email envoyé et journalisé.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={choisi ? choisi.nom : "Écrire / Relancer"}
      description={
        choisi
          ? "Ajuste le texte avant de copier ou d'envoyer — le modèle d'origine n'est pas modifié."
          : `Choisis un modèle — les suggérés correspondent à l'état du dossier (${lead.statut}).`
      }
      size="xl"
    >
      {!choisi ? (
        <div className="space-y-1.5">
          {liste.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun modèle disponible pour cette entité.</p>
          ) : (
            liste.map((m) => {
              const suggere = declencheurActif(m.declencheur, lead);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectModele(m)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-cream/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{m.nom}</span>
                    <span className="block truncate text-[12px] text-muted">{m.objet}</span>
                  </span>
                  {suggere ? (
                    <Badge tone="success">
                      <Sparkles className="mr-1 size-3" strokeWidth={2} />
                      Suggéré
                    </Badge>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setChoisi(null)}
            className="inline-flex items-center gap-1.5 text-[13px] text-brand"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Modèles
          </button>

          {manquantes.length > 0 ? (
            <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />À compléter avant envoi :
              </p>
              <p className="mt-0.5 font-mono">{manquantes.map((t) => `{{${t}}}`).join(" · ")}</p>
            </div>
          ) : null}

          <Field label="Objet">
            <Input value={objet} onChange={(e) => setObjet(e.target.value)} />
          </Field>
          <Field label="Corps">
            <Textarea
              rows={9}
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              className="leading-relaxed"
            />
          </Field>

          {msg ? <p className="text-[13px] text-muted">{msg}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={copie ? Check : ClipboardCopy} onClick={copier}>
              {copie ? "Copié" : "Copier le mail"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={journalise ? Check : History}
              onClick={journaliser}
              disabled={journalise}
            >
              {journalise ? "Journalisé" : "Journaliser l'envoi"}
            </Button>
            <span title={!smtp ? "Copier-coller pour l'instant (SMTP non configuré)." : undefined}>
              <Button
                size="sm"
                icon={Send}
                onClick={envoyerCrm}
                disabled={!smtp || !lead.email || envoi}
              >
                {envoi ? "Envoi…" : "Envoyer via CRM"}
              </Button>
            </span>
          </div>
          {!lead.email ? (
            <p className="text-[12px] text-muted">Aucun email client — copie le mail et envoie-le à la main.</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
