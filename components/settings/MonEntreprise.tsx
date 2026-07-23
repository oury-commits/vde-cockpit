"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, CircleCheck, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import { validerFiche } from "@/lib/entreprise/validation";
import { uploadLogo, type LogoKind } from "@/lib/entreprise/storage";
import type { ParametresEntreprise } from "@/lib/entreprise/types";

// Bandeau d'entité — garde-fou visuel anti-confusion. Pas d'emoji (règle brand) :
// couleur + libellé géant suffisent à savoir QUELLE société on édite.
const ENT_META: Record<string, { label: string; sous: string; bg: string; fg: string }> = {
  FR: { label: "VDE FRANCE", sous: "France · EUR (€)", bg: "bg-brand", fg: "text-cream" },
  MA: { label: "VDE MAROC", sous: "Maroc · Dirham (DH)", bg: "bg-gold", fg: "text-brand" },
};
const metaDe = (e: string) =>
  ENT_META[e] ?? { label: `VDE ${e}`, sous: e, bg: "bg-muted", fg: "text-cream" };

export function MonEntreprise() {
  const { identite } = useIdentity();
  const { fiches, fiche, enregistrer } = useEntreprise();
  const estAdmin = identite.role === "admin";

  const entites = useMemo(
    () => Array.from(new Set<string>(["FR", "MA", ...fiches.map((f) => f.entite)])),
    [fiches],
  );

  const [entite, setEntite] = useState("FR");
  const [form, setForm] = useState<ParametresEntreprise>(() => fiche("FR"));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const fileComplet = useRef<HTMLInputElement>(null);
  const fileSymbole = useRef<HTMLInputElement>(null);

  // Recharge la fiche de l'entité sélectionnée — JAMAIS de fusion entre entités.
  useEffect(() => {
    setForm(fiche(entite));
    setOk(false);
    setErreurAction(null);
  }, [entite, fiche]);

  const erreurs = useMemo(() => validerFiche(entite, form), [entite, form]);
  const meta = metaDe(entite);
  const set = <K extends keyof ParametresEntreprise>(k: K, v: ParametresEntreprise[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (!estAdmin) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Building2 className="size-4 text-brand" strokeWidth={1.75} />
          Mon entreprise
        </h3>
        <p className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Réservé à l&apos;administrateur. Ces informations alimentent l&apos;en-tête
          et le pied des devis et factures.
        </p>
      </section>
    );
  }

  const onUpload = async (kind: LogoKind, file: File | undefined) => {
    if (!file) return;
    setErreurAction(null);
    const r = await uploadLogo(entite, kind, file);
    if (r.url) set(kind === "complet" ? "logo_complet_url" : "logo_symbole_url", r.url);
    else setErreurAction(r.raison ?? "Upload impossible.");
  };

  const confirmer = async () => {
    setBusy(true);
    setErreurAction(null);
    const res = await enregistrer(form);
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) setOk(true);
    else setErreurAction(res.error ?? "Enregistrement impossible.");
  };

  // Récap de confirmation : les identifiants clés de l'entité éditée.
  const recap =
    entite === "FR"
      ? [form.siret && `SIRET ${form.siret}`, form.tva_intra && `TVA ${form.tva_intra}`, form.iban && `IBAN ${form.iban}`]
      : [form.ice && `ICE ${form.ice}`, form.rc && `RC ${form.rc}`, form.rib && `RIB ${form.rib}`];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Building2 className="size-4 text-brand" strokeWidth={1.75} />
        Mon entreprise
      </h3>
      <p className="mt-1 text-sm text-muted">
        Identité société PAR ENTITÉ — alimente l&apos;en-tête et le pied des devis
        &amp; factures. Chaque société a sa propre fiche, jamais mélangée.
      </p>

      {/* Sélecteur d'entité */}
      <div className="mt-4 flex flex-wrap gap-2">
        {entites.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEntite(e)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              e === entite
                ? "bg-brand text-cream"
                : "border border-line bg-surface text-ink hover:bg-cream"
            }`}
          >
            {metaDe(e).label}
          </button>
        ))}
      </div>

      {/* BANDEAU GÉANT — impossible de se tromper de société */}
      <div className={`mt-4 rounded-xl ${meta.bg} px-5 py-4`}>
        <p className={`font-serif text-2xl italic ${meta.fg}`}>{meta.label}</p>
        <p className={`mt-0.5 text-[13px] ${meta.fg} opacity-90`}>
          Tu édites la fiche : {meta.sous}
        </p>
      </div>

      <div className="mt-5 space-y-5">
        {/* 1. Identité visuelle */}
        <Bloc titre="Identité visuelle">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Couleur de marque">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.couleur_marque || "#0F3D2E"}
                  onChange={(e) => set("couleur_marque", e.target.value)}
                  className="h-9 w-12 rounded-lg border border-line"
                />
                <Input
                  className="font-mono"
                  value={form.couleur_marque ?? ""}
                  onChange={(e) => set("couleur_marque", e.target.value)}
                />
              </div>
            </Field>
            <Logo
              label="Logo (complet)"
              url={form.logo_complet_url}
              inputRef={fileComplet}
              onPick={(f) => void onUpload("complet", f)}
            />
            <Logo
              label="Symbole / tampon"
              url={form.logo_symbole_url}
              inputRef={fileSymbole}
              onPick={(f) => void onUpload("symbole", f)}
            />
          </div>
        </Bloc>

        {/* 2. Informations société */}
        <Bloc titre="Informations société">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Champ label="Raison sociale" v={form.raison_sociale} on={(x) => set("raison_sociale", x)} />
            <Champ label="Forme juridique" v={form.forme_juridique} on={(x) => set("forme_juridique", x)} />
            <Champ label="Capital social" v={form.capital_social} on={(x) => set("capital_social", x)} />
            <Champ label="Adresse du siège" v={form.adresse_siege} on={(x) => set("adresse_siege", x)} />
            <Champ label="Téléphone" v={form.telephone} on={(x) => set("telephone", x)} />
            <Champ label="Email" v={form.email} on={(x) => set("email", x)} err={champErr("email")} />
            <Champ label="Site web" v={form.site_web} on={(x) => set("site_web", x)} />
          </div>
        </Bloc>

        {/* 3. Identifiants légaux — ADAPTÉ à l'entité */}
        <Bloc titre="Identifiants légaux">
          {entite === "FR" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Champ label="SIRET (14 chiffres)" v={form.siret} on={(x) => set("siret", x)} err={champErr("siret")} mono />
              <Champ label="N° TVA intracommunautaire" v={form.tva_intra} on={(x) => set("tva_intra", x)} err={champErr("tva_intra")} mono />
              <Champ label="RCS + ville" v={form.rcs} on={(x) => set("rcs", x)} />
              <Champ label="Code APE / NAF" v={form.code_ape} on={(x) => set("code_ape", x)} />
            </div>
          ) : entite === "MA" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Champ label="ICE (15 chiffres)" v={form.ice} on={(x) => set("ice", x)} err={champErr("ice")} mono />
              <Champ label="RC + ville" v={form.rc} on={(x) => set("rc", x)} err={champErr("rc")} />
              <Champ label="IF (identifiant fiscal)" v={form.if_fiscal} on={(x) => set("if_fiscal", x)} mono />
              <Champ label="Patente" v={form.patente} on={(x) => set("patente", x)} />
              <Champ label="N° CNSS" v={form.cnss} on={(x) => set("cnss", x)} />
            </div>
          ) : (
            <p className="text-[13px] text-muted">Identifiants à définir pour cette entité.</p>
          )}
        </Bloc>

        {/* 4. Régime de TVA (mention) — devise/taux gérés ailleurs */}
        <Bloc titre="Fiscalité">
          <Champ
            label="Mention de régime (ex. autoliquidation BTP)"
            v={form.mention_regime}
            on={(x) => set("mention_regime", x)}
          />
          <p className="mt-1 text-[12px] text-muted">
            Devise et taux de TVA suivent automatiquement l&apos;entité (non
            éditables ici).
          </p>
        </Bloc>

        {/* 5. Coordonnées bancaires — ADAPTÉ, jamais le RIB de l'autre pays */}
        <Bloc titre="Coordonnées bancaires (paiement)">
          {entite === "FR" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Champ label="IBAN (FR76…)" v={form.iban} on={(x) => set("iban", x)} err={champErr("iban")} mono />
              <Champ label="BIC / SWIFT" v={form.bic} on={(x) => set("bic", x)} mono />
              <Champ label="Banque" v={form.banque} on={(x) => set("banque", x)} />
            </div>
          ) : entite === "MA" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Champ label="RIB Maroc" v={form.rib} on={(x) => set("rib", x)} err={champErr("rib")} mono />
              <Champ label="Banque" v={form.banque} on={(x) => set("banque", x)} />
            </div>
          ) : null}
        </Bloc>

        {/* 6. Mentions & conformité */}
        <Bloc titre="Mentions & conformité">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Certifications (séparées par une virgule)">
              <Input
                value={form.certifications.join(", ")}
                onChange={(e) =>
                  set(
                    "certifications",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="RGE, IRVE, Qualifelec, ADVENIR"
              />
            </Field>
            {entite === "FR" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Champ
                  label="Assurance décennale — compagnie"
                  v={form.assurance_decennale_compagnie}
                  on={(x) => set("assurance_decennale_compagnie", x)}
                />
                <Champ
                  label="Assurance décennale — n° de police"
                  v={form.assurance_decennale_police}
                  on={(x) => set("assurance_decennale_police", x)}
                />
              </div>
            ) : null}
            <Field label="Mentions légales (texte libre)">
              <Textarea
                rows={3}
                value={form.mentions_legales ?? ""}
                onChange={(e) => set("mentions_legales", e.target.value)}
              />
            </Field>
          </div>
        </Bloc>
      </div>

      {/* Blocage sur format invalide */}
      {erreurs.length > 0 ? (
        <div className="mt-4 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2.5 text-[13px] text-alert">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
            Format invalide — enregistrement bloqué :
          </p>
          <ul className="mt-1 list-disc pl-5">
            {erreurs.map((e) => (
              <li key={e.champ}>{e.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {erreurAction ? (
        <p className="mt-3 text-[13px] text-alert">{erreurAction}</p>
      ) : null}
      {ok ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-success">
          <CircleCheck className="size-4 shrink-0" strokeWidth={2} />
          Fiche {meta.label} enregistrée.
        </p>
      ) : null}

      <div className="mt-4">
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={erreurs.length > 0 || busy}
        >
          Enregistrer {meta.label}
        </Button>
      </div>

      {/* Confirmation avant sauvegarde — zéro sauvegarde à l'aveugle */}
      {confirmOpen ? (
        <Modal
          open
          onClose={() => setConfirmOpen(false)}
          title="Confirmer l'enregistrement"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Annuler
              </Button>
              <Button onClick={confirmer} disabled={busy}>
                {busy ? "Enregistrement…" : `Confirmer — ${meta.label}`}
              </Button>
            </>
          }
        >
          <div className={`rounded-xl ${meta.bg} px-4 py-3`}>
            <p className={`font-serif text-xl italic ${meta.fg}`}>{meta.label}</p>
          </div>
          <p className="mt-3 text-sm text-ink">
            Tu enregistres la fiche <strong>{form.raison_sociale || meta.label}</strong> :
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[13px] text-muted">
            {recap.filter(Boolean).map((r) => (
              <li key={r as string}>· {r}</li>
            ))}
            {recap.filter(Boolean).length === 0 ? (
              <li>· (aucun identifiant clé renseigné)</li>
            ) : null}
          </ul>
          <p className="mt-3 text-[12px] text-muted">
            Ces informations apparaîtront sur les devis et factures {meta.label}.
          </p>
        </Modal>
      ) : null}
    </section>
  );

  function champErr(champ: string): string | undefined {
    return erreurs.find((e) => e.champ === champ)?.message;
  }
}

// ── petits composants internes ──────────────────────────────────────────────

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {titre}
      </p>
      {children}
    </div>
  );
}

function Champ({
  label,
  v,
  on,
  err,
  mono,
}: {
  label: string;
  v: string | null;
  on: (x: string) => void;
  err?: string;
  mono?: boolean;
}) {
  return (
    <Field label={label}>
      <Input
        className={mono ? "font-mono" : undefined}
        value={v ?? ""}
        onChange={(e) => on(e.target.value)}
        aria-invalid={err ? true : undefined}
      />
      {err ? <span className="mt-1 block text-[12px] text-alert">{err}</span> : null}
    </Field>
  );
}

function Logo({
  label,
  url,
  inputRef,
  onPick,
}: {
  label: string;
  url: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-9 w-9 rounded border border-line object-contain" />
        ) : (
          <span className="grid size-9 place-items-center rounded border border-dashed border-line text-muted">
            <Building2 className="size-4" strokeWidth={1.5} />
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Upload}
          onClick={() => inputRef.current?.click()}
        >
          Choisir
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </div>
    </Field>
  );
}
