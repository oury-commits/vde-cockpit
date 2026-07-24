"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Send } from "lucide-react";
import type { Devis, Facture, Lead } from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { devisPdfBlob, generateDevisPdf, nomFichierDevis } from "@/lib/leads/devis";
import { facturePdfBlob, generateFacturePdf } from "@/lib/leads/facture";
import { uploadDocument } from "@/lib/documents/storage";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import {
  emailDevis,
  emailFacture,
  expediteur,
  mailtoHref,
} from "@/lib/documents/email";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function EnvoiDialog({
  open,
  onClose,
  lead,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  kind: "devis" | "facture";
}) {
  const store = useLeadsStore();
  const { fiche } = useEntreprise();
  const doc = kind === "devis" ? lead.devis : lead.facture;
  // Fiche de l'entité du document — UNIQUEMENT celle-ci (jamais l'autre pays).
  const ficheDoc = doc ? fiche(doc.entite) : null;

  const [to, setTo] = useState(lead.email ?? "");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // L'envoi automatique n'est disponible que si la clé Resend est présente
  // côté serveur — sinon on prépare l'email (fallback mailto:).
  useEffect(() => {
    if (!open) return;
    setTo(lead.email ?? "");
    setError(null);
    setDone(false);
    fetch("/api/send-devis")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d?.configured)))
      .catch(() => setConfigured(false));
  }, [open, lead.email]);

  const apercu = useMemo(() => {
    if (!doc) return null;
    return kind === "devis"
      ? emailDevis(doc as Devis, lead.nom, null, ficheDoc)
      : emailFacture(doc as Facture, lead.nom, null, ficheDoc);
  }, [doc, kind, lead.nom, ficheDoc]);

  if (!doc || !apercu) return null;

  const envoyer = async () => {
    if (!EMAIL_RE.test(to.trim())) {
      setError("Adresse email invalide.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 1) PDF · 2) dépôt Storage (lien signé, null en démo) · 3) email
      const pdf =
        kind === "devis"
          ? await devisPdfBlob(lead, doc as Devis, lead.echeancier ?? undefined, ficheDoc)
          : await facturePdfBlob(lead, doc as Facture, ficheDoc);
      // Devis : nom de téléchargement client NEUTRE (« Devis-Nom.pdf »), sans le
      // n°. Facture : garde son n° (obligation légale). Le chemin storage garde
      // le n° dans les deux cas (classement interne).
      const { url } = await uploadDocument(
        doc.entite,
        doc.ref,
        pdf,
        kind === "devis" ? nomFichierDevis(lead.nom) : undefined,
      );
      const mail =
        kind === "devis"
          ? emailDevis(doc as Devis, lead.nom, url, ficheDoc)
          : emailFacture(doc as Facture, lead.nom, url, ficheDoc);

      if (configured) {
        const res = await fetch("/api/send-devis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: to.trim(),
            sujet: mail.sujet,
            texte: mail.texte,
            from: expediteur(doc.entite),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Envoi impossible.");
        }
      } else {
        // Fallback : PDF téléchargé + email pré-rempli à envoyer à la main.
        if (kind === "devis") {
          await generateDevisPdf(lead, doc as Devis, lead.echeancier ?? undefined, ficheDoc);
        } else {
          await generateFacturePdf(lead, doc as Facture, ficheDoc);
        }
        window.location.href = mailtoHref(to.trim(), mail);
      }

      store.recordEnvoi(lead.id, kind, to.trim());
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const auto = configured === true;
  const label = kind === "devis" ? "devis" : "facture";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Envoyer le ${label} au client`}
      description={`${doc.ref} · ${lead.nom}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            icon={auto ? Send : Mail}
            onClick={envoyer}
            disabled={busy || done || configured === null}
          >
            {done
              ? "Envoyé"
              : busy
                ? "Envoi…"
                : auto
                  ? "Envoyer l'email"
                  : "Préparer l'email"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Destinataire">
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="client@exemple.fr"
          />
        </Field>

        <div>
          <span className="mb-1 block text-[12px] font-semibold text-muted">
            Objet
          </span>
          <p className="text-sm text-ink">{apercu.sujet}</p>
        </div>

        <div>
          <span className="mb-1 block text-[12px] font-semibold text-muted">
            Message
          </span>
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-cream/40 p-3 font-sans text-[13px] leading-relaxed text-ink">
            {apercu.texte}
          </pre>
        </div>

        {configured === null ? (
          <p className="text-[11px] text-muted">Vérification du service d&apos;envoi…</p>
        ) : auto ? (
          <p className="text-[11px] text-muted">
            Le PDF est déposé sur le stockage sécurisé ; le message contient un
            lien signé expirant (7 jours).
          </p>
        ) : (
          <p className="text-[11px] text-muted">
            Envoi automatique indisponible : le PDF sera téléchargé et votre
            messagerie s&apos;ouvrira pré-remplie — joignez le PDF avant d&apos;envoyer.
            {/* TODO: brancher données réelles — RESEND_API_KEY pour l'envoi auto. */}
          </p>
        )}

        {error ? (
          <p className="text-[12px] font-medium text-alert">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
