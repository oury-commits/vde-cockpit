"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/ui/PageTitle";
import { cn } from "@/lib/cn";
import { useEntity } from "@/lib/entite/EntityProvider";
import { useCatalogueStore } from "@/lib/catalogue/store";
import { useLeadsStore } from "@/lib/leads/store";
import { entiteConfig, optionTva, ENTITE_LABEL } from "@/lib/entite/config";
import type { AideLigne, DevisDraft, VueDevis } from "@/lib/devis/types";
import { WIZARD_STEPS } from "@/lib/devis/types";
import {
  aidesTotal,
  deriveLignes,
  draftFromLead,
  emptyDraft,
} from "@/lib/devis/builder";
import { buildEcheancierPaiement, computeTotaux } from "@/lib/devis/pricing";
import { buildDevisSnapshot, nextDevisRef } from "@/lib/devis/output";
import { generateDevisPdfFromDraft } from "@/lib/devis/pdf";
import { WizardContext, type WizardValue } from "@/components/devis/context";
import { DevisPreview } from "@/components/devis/DevisPreview";
import { StepClient } from "@/components/devis/steps/StepClient";
import { StepAides } from "@/components/devis/steps/StepAides";
import { StepConfig } from "@/components/devis/steps/StepConfig";
import { StepSupplements } from "@/components/devis/steps/StepSupplements";
import { StepSynthese } from "@/components/devis/steps/StepSynthese";

export function DevisWizard({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const { entiteForCreate } = useEntity();
  const catalogue = useCatalogueStore();
  const leads = useLeadsStore();

  const [draft, setDraft] = useState<DevisDraft | null>(null);
  const [step, setStep] = useState(0);
  const [vue, setVue] = useState<VueDevis>("client");
  const [saved, setSaved] = useState(false);

  // Initialise le brouillon une fois les données prêtes (lead + catalogue).
  useEffect(() => {
    if (draft) return;
    if (!catalogue.loaded) return;
    if (leadId && !leads.loaded) return;
    const lead = leadId ? leads.leads.find((l) => l.id === leadId) ?? null : null;
    const entite = lead ? lead.entite : entiteForCreate;
    const actifs = catalogue.articles.filter(
      (a) => a.actif && a.entite === entite,
    );
    setDraft(lead ? draftFromLead(lead, actifs) : emptyDraft(entite));
  }, [
    draft,
    catalogue.loaded,
    catalogue.articles,
    leads.loaded,
    leads.leads,
    leadId,
    entiteForCreate,
  ]);

  const articles = useMemo(
    () =>
      draft
        ? catalogue.articles.filter((a) => a.actif && a.entite === draft.entite)
        : [],
    [catalogue.articles, draft],
  );

  const lignes = useMemo(
    () => (draft ? deriveLignes(draft, articles, draft.taux_marge) : []),
    [draft, articles],
  );

  const totaux = useMemo(() => {
    if (!draft) return null;
    const taux = optionTva(draft.entite, draft.mode_tva).taux;
    return computeTotaux(lignes, taux, aidesTotal(draft));
  }, [draft, lignes]);

  const value = useMemo<WizardValue | null>(() => {
    if (!draft || !totaux) return null;
    return {
      draft,
      articles,
      lignes,
      totaux,
      vue,
      setVue,
      patch: (partial) => setDraft((d) => (d ? { ...d, ...partial } : d)),
      patchClient: (partial) =>
        setDraft((d) => (d ? { ...d, client: { ...d.client, ...partial } } : d)),
      patchConfig: (partial) =>
        setDraft((d) => (d ? { ...d, config: { ...d.config, ...partial } } : d)),
      toggleConformite: (key) =>
        setDraft((d) =>
          d
            ? {
                ...d,
                conformite: d.conformite.map((p) =>
                  p.key === key ? { ...p, ok: !p.ok } : p,
                ),
              }
            : d,
        ),
      patchAide: (key, partial: Partial<AideLigne>) =>
        setDraft((d) =>
          d
            ? {
                ...d,
                aides: d.aides.map((a) =>
                  a.key === key ? { ...a, ...partial } : a,
                ),
              }
            : d,
        ),
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
    };
  }, [draft, totaux, articles, lignes, vue]);

  if (!draft || !totaux || !value) {
    return (
      <p className="py-24 text-center text-sm text-muted">Chargement…</p>
    );
  }

  const canExport = lignes.length > 0;
  const isLast = step === WIZARD_STEPS.length - 1;

  const buildRef = () => {
    const existing = leads.leads
      .map((l) => l.devis?.ref)
      .filter((r): r is string => Boolean(r));
    return nextDevisRef(existing, draft.entite);
  };

  const handlePdf = () => {
    const ref = buildRef();
    const dateISO = new Date().toISOString();
    const echeances = buildEcheancierPaiement(
      totaux.montant_ttc,
      draft.mode_paiement,
    );
    generateDevisPdfFromDraft(draft, lignes, totaux, ref, dateISO, echeances);
  };

  const handleSave = () => {
    if (!leadId) return;
    const ref = buildRef();
    const dateISO = new Date().toISOString();
    const devis = buildDevisSnapshot(draft, lignes, totaux, ref, dateISO);
    const echeances = buildEcheancierPaiement(
      totaux.montant_ttc,
      draft.mode_paiement,
    );
    leads.attachDevis(leadId, devis, echeances);
    setSaved(true);
    setTimeout(() => router.push(`/leads/${leadId}`), 600);
  };

  const StepBody = [StepClient, StepAides, StepConfig, StepSupplements, StepSynthese][
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
          <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
            {ENTITE_LABEL[draft.entite]} · {entiteConfig(draft.entite).symbole}
          </span>
          {draft.lead_id ? (
            <span className="text-sm text-muted">
              depuis {draft.client.nom || "le lead"}
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
          {/* Colonne formulaire */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <StepBody />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
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
                    <Button
                      variant="secondary"
                      icon={Download}
                      onClick={handlePdf}
                      disabled={!canExport}
                    >
                      <span className="hidden sm:inline">Télécharger le PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </Button>
                    {leadId ? (
                      <Button
                        icon={saved ? Check : Save}
                        onClick={handleSave}
                        disabled={!canExport || saved}
                      >
                        {saved ? "Enregistré" : "Enregistrer"}
                      </Button>
                    ) : null}
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
          </div>

          {/* Colonne aperçu */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <DevisPreview />
          </div>
        </div>
      </div>
    </WizardContext.Provider>
  );
}
