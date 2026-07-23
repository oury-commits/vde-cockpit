"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCheck2,
  ListPlus,
  PackageCheck,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/ui/PageTitle";
import { cn } from "@/lib/cn";
import { useEntity } from "@/lib/entite/EntityProvider";
import { useCatalogueStore } from "@/lib/catalogue/store";
import { useSettings } from "@/lib/settings/store";
import { prixArticle } from "@/lib/catalogue/prix";
import type { CatalogueArticle } from "@/lib/catalogue/types";
import { useLeadsStore } from "@/lib/leads/store";
import { entiteConfig, ENTITE_LABEL } from "@/lib/entite/config";
import { generateDevisPdf } from "@/lib/leads/devis";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import type { DevisDraft, ModeDevis, VueDevis } from "@/lib/devis/types";
import { MODE_DEVIS_LABEL, WIZARD_STEPS } from "@/lib/devis/types";
import { buildDraft, deriveLignes } from "@/lib/devis/builder";
import {
  buildEcheancierPaiement,
  computeTotaux,
  margeNiveau,
} from "@/lib/devis/pricing";
import {
  computeControle,
  estConforme,
  rentabilite,
} from "@/lib/devis/conformite";
import { buildDevisSnapshot } from "@/lib/devis/output";
import { reserveRef } from "@/lib/leads/sequences";
import { WizardContext, type WizardValue } from "@/components/devis/context";
import { DevisPreview } from "@/components/devis/DevisPreview";
import { StepClient } from "@/components/devis/steps/StepClient";
import { StepConfig } from "@/components/devis/steps/StepConfig";
import { StepSupplements } from "@/components/devis/steps/StepSupplements";
import { StepSynthese } from "@/components/devis/steps/StepSynthese";

const RENT_TONE: Record<string, string> = {
  correcte: "bg-success/12 text-success",
  faible: "bg-alert/12 text-alert",
  elevee: "bg-gold/20 text-gold-ink",
};

export function DevisWizard({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const { entiteForCreate } = useEntity();
  const catalogue = useCatalogueStore();
  const leads = useLeadsStore();
  const { tauxMad } = useSettings();
  const { fiche } = useEntreprise();

  const [draft, setDraft] = useState<DevisDraft | null>(null);
  const [step, setStep] = useState(0);
  const [vue, setVue] = useState<VueDevis>("client");
  const [saved, setSaved] = useState<null | "brouillon" | "valide">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Vente à perte : on ne bloque pas Oury, on lui fait confirmer une fois.
  const [confirmPerte, setConfirmPerte] = useState(false);

  const ready = catalogue.loaded && (!leadId || leads.loaded);
  const lead = leadId ? leads.leads.find((l) => l.id === leadId) ?? null : null;
  const entite = lead ? lead.entite : entiteForCreate;

  const start = (mode: ModeDevis) => {
    const actifs = catalogue.articles.filter((a) => a.actif);
    setDraft(buildDraft(mode, entite, lead, actifs));
  };

  // Catalogue partagé (base EUR). Le coût est converti selon l'entité du devis :
  // EUR pour FR, MAD (dérivé du taux ou surchargé) pour MA.
  const entiteDraft = draft?.entite;
  const coutOf = useMemo(
    () => (a: CatalogueArticle) =>
      entiteDraft ? prixArticle(a, entiteDraft, tauxMad) : a.cout_ht,
    [entiteDraft, tauxMad],
  );

  const articles = useMemo(
    () => (draft ? catalogue.articles.filter((a) => a.actif) : []),
    [catalogue.articles, draft],
  );
  const lignes = useMemo(
    () => (draft ? deriveLignes(draft, articles, draft.taux_marge, coutOf) : []),
    [draft, articles, coutOf],
  );
  const totaux = useMemo(() => {
    if (!draft) return null;
    // La TVA est portée par chaque ligne (deriveLignes) ; computeTotaux la
    // ventile. Plus de taux global passé ici.
    return computeTotaux(lignes, {
      type: draft.remise_type,
      valeur: draft.remise_valeur,
    });
  }, [draft, lignes]);
  const controle = useMemo(
    () =>
      draft
        ? computeControle(draft.config, articles, draft.controle_non_conformes)
        : [],
    [draft, articles],
  );

  const value = useMemo<WizardValue | null>(() => {
    if (!draft || !totaux) return null;
    return {
      draft,
      articles,
      coutOf,
      lignes,
      totaux,
      controle,
      vue,
      setVue,
      patch: (p) => setDraft((d) => (d ? { ...d, ...p } : d)),
      patchClient: (p) =>
        setDraft((d) => (d ? { ...d, client: { ...d.client, ...p } } : d)),
      patchConfig: (p) =>
        setDraft((d) => (d ? { ...d, config: { ...d.config, ...p } } : d)),
      setSupplement: (articleId, quantite) =>
        setDraft((d) => {
          if (!d) return d;
          const rest = d.supplements.filter((s) => s.article_id !== articleId);
          return {
            ...d,
            supplements:
              quantite > 0 ? [...rest, { article_id: articleId, quantite }] : rest,
          };
        }),
      setTauxLigne: (articleId, taux) =>
        setDraft((d) =>
          d
            ? {
                ...d,
                taux_tva_overrides: { ...d.taux_tva_overrides, [articleId]: taux },
              }
            : d,
        ),
      toggleControle: (key) =>
        setDraft((d) => {
          if (!d) return d;
          const set = new Set(d.controle_non_conformes);
          set.has(key) ? set.delete(key) : set.add(key);
          return { ...d, controle_non_conformes: [...set] };
        }),
    };
  }, [draft, totaux, articles, coutOf, lignes, controle, vue]);

  // ── États d'attente / sélection du mode ──
  if (!ready) {
    return <p className="py-24 text-center text-sm text-muted">Chargement…</p>;
  }
  if (!draft || !totaux || !value) {
    return <ModeChooser entite={entite} lead={lead} onPick={start} />;
  }

  const conforme = estConforme(controle);
  const canExport = lignes.length > 0;
  const clientNom = draft.client.nom.trim();
  const isLast = step === WIZARD_STEPS.length - 1;
  const rent = rentabilite(totaux.marge_pct);

  const finalize = async (statut: "brouillon" | "envoye") => {
    if (busy || saved) return;
    setError(null);
    const echeances = buildEcheancierPaiement(
      totaux.montant_ttc,
      draft.mode_paiement,
    );
    const dateISO = new Date().toISOString();

    // Brouillon : AUCUN numéro consommé (réservé à l'émission seulement).
    if (statut === "brouillon") {
      if (!leadId) return;
      const devis = buildDevisSnapshot(
        draft, lignes, totaux, "Brouillon", dateISO, "brouillon",
      );
      leads.attachDevis(leadId, devis, echeances);
      setSaved("brouillon");
      setTimeout(() => router.push(`/leads/${leadId}`), 700);
      return;
    }

    // Émission — garde anti-fantôme : lead rattaché + nom + lignes + conformité.
    if (!clientNom) {
      setError("Renseigne le nom du client avant d'émettre le devis.");
      return;
    }
    if (!canExport || !conforme) return;

    // Vente à perte : bloquant mais forçable. Première tentative → on demande
    // confirmation ; la seconde passe. Une case décochée ne vend jamais à perte
    // par inadvertance.
    if (margeNiveau(totaux.marge_pct) === "perte" && !confirmPerte) {
      setConfirmPerte(true);
      setError(
        `Marge négative (${Math.round(totaux.marge_pct * 100)} %) — tu vends à perte. Re-clique sur « Valider » pour confirmer l'émission.`,
      );
      return;
    }

    setBusy(true);
    try {
      // Rattachement obligatoire : lead existant, sinon client créé à la volée.
      let targetId = leadId ?? null;
      if (!targetId) {
        const res = leads.addLead({
          nom: clientNom,
          telephone: draft.client.telephone,
          email: draft.client.email || undefined,
          adresse: draft.client.adresse || undefined,
          code_postal: draft.client.code_postal || undefined,
          ville: draft.client.ville || undefined,
          entite: draft.entite,
        });
        targetId = res.lead?.id ?? res.duplicate?.id ?? null;
      }
      if (!targetId) {
        setError("Impossible de rattacher le devis à un client.");
        return;
      }

      // Numéro réservé atomiquement, puis persistance, puis PDF.
      const ref = await reserveRef(draft.entite, "devis");
      const devis = buildDevisSnapshot(draft, lignes, totaux, ref, dateISO, "envoye");
      leads.attachDevis(targetId, devis, echeances); // persistance d'abord
      await generateDevisPdf(draft.client, devis, echeances, fiche(draft.entite)); // PDF ensuite (marge masquée)
      setSaved("valide");
      const goId = targetId;
      setTimeout(() => router.push(`/leads/${goId}`), 700);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Échec de l'émission du devis.",
      );
    } finally {
      setBusy(false);
    }
  };

  const StepBody = [StepClient, StepConfig, StepSupplements, StepSynthese][
    step
  ];

  return (
    <WizardContext.Provider value={value}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => router.back()}
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <PageTitle>Nouveau devis</PageTitle>
          <span className="rounded-full bg-brand/8 px-2.5 py-0.5 text-xs font-medium text-brand">
            {MODE_DEVIS_LABEL[draft.mode]}
          </span>
          <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
            {ENTITE_LABEL[draft.entite]} · {entiteConfig(draft.entite).symbole}
          </span>
          {/* Indicateur de rentabilité (marge réelle) */}
          {canExport ? (
            <span
              className={cn(
                "ml-auto rounded-full px-2.5 py-1 font-mono text-xs font-semibold",
                RENT_TONE[rent.niveau],
              )}
            >
              {rent.label} · {Math.round(totaux.marge_pct * 100)} %
            </span>
          ) : null}
        </header>

        {/* Stepper */}
        <ol className="flex items-center gap-1 overflow-x-auto pb-1">
          {WIZARD_STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    current
                      ? "bg-brand/10 text-brand"
                      : "text-muted hover:bg-cream hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px]",
                      current
                        ? "bg-brand text-cream"
                        : done
                          ? "bg-success/20 text-success"
                          : "bg-line text-muted",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap font-medium">{s.label}</span>
                </button>
                {i < WIZARD_STEPS.length - 1 ? (
                  <span className="mx-0.5 h-px w-3 shrink-0 bg-line sm:w-5" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <StepBody />
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                icon={ArrowLeft}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Précédent
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {isLast ? (
                  <>
                    {leadId ? (
                      <Button
                        variant="secondary"
                        icon={Save}
                        onClick={() => finalize("brouillon")}
                        disabled={!canExport || busy || saved !== null}
                      >
                        Brouillon
                      </Button>
                    ) : null}
                    <Button
                      icon={saved === "valide" ? Check : FileCheck2}
                      onClick={() => finalize("envoye")}
                      disabled={
                        !canExport || !conforme || !clientNom || busy || saved !== null
                      }
                      title={
                        !clientNom
                          ? "Renseigne le nom du client"
                          : !conforme
                            ? "Installation non conforme — corrigez le contrôle technique"
                            : undefined
                      }
                    >
                      {saved === "valide"
                        ? "Devis émis"
                        : busy
                          ? "Émission…"
                          : "Valider le devis"}
                    </Button>
                  </>
                ) : (
                  <Button
                    icon={ArrowRight}
                    onClick={() =>
                      setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))
                    }
                  >
                    Suivant
                  </Button>
                )}
              </div>
            </div>
            {isLast ? (
              <p className="text-right text-xs font-medium text-alert">
                {error
                  ? error
                  : !clientNom
                    ? "Renseigne le nom du client pour émettre le devis."
                    : !conforme
                      ? "Contrôle technique non conforme — validation bloquée."
                      : ""}
              </p>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <DevisPreview />
          </div>
        </div>
      </div>
    </WizardContext.Provider>
  );
}

function ModeChooser({
  entite,
  lead,
  onPick,
}: {
  entite: DevisDraft["entite"];
  lead: { nom: string } | null;
  onPick: (mode: ModeDevis) => void;
}) {
  const cards: {
    mode: ModeDevis;
    icon: typeof PackageCheck;
    desc: string;
  }[] = [
    {
      mode: "standard",
      icon: PackageCheck,
      desc: "Composition guidée : borne, pose et consommables pré-remplis depuis la qualif du lead.",
    },
    {
      mode: "libre",
      icon: ListPlus,
      desc: "Accès complet au catalogue, ligne par ligne, sans pré-composition.",
    },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-baseline gap-3">
        <PageTitle>Nouveau devis</PageTitle>
        <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
          {ENTITE_LABEL[entite]}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted">
        {lead ? `Depuis ${lead.nom}. ` : ""}Choisissez le mode d'entrée.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ mode, icon: Icon, desc }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onPick(mode)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-brand/40 hover:bg-cream/40"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <span className="text-base font-semibold text-ink">
              {MODE_DEVIS_LABEL[mode]}
            </span>
            <span className="text-sm text-muted">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
