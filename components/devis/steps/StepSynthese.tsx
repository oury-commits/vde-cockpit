"use client";

import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import { MARGE_MAX, SEUIL_MARGE_ALERTE, margeNiveau } from "@/lib/devis/pricing";
import { pvEligibilite } from "@/lib/devis/solaire";
import { almaPhrase } from "@/lib/leads/reglements";
import { pctTva } from "@/lib/devis/tva";
import type { ModePaiement } from "@/lib/devis/types";

export function StepSynthese() {
  const {
    draft,
    articles,
    totaux,
    patch,
    lignes,
    setLigneNom,
    setLignePu,
    addLigneLibre,
    updateLigneLibre,
    removeLigneLibre,
  } = useWizard();
  const cfgEntite = entiteConfig(draft.entite);
  const solaire = draft.domaine === "solaire";
  const pvElig = solaire ? pvEligibilite(draft, articles) : null;
  const devise = cfgEntite.devise;
  const m = (n: number) => formatMontant(n, devise, { cents: true });

  const margePct = Math.round(draft.taux_marge * 100);
  const setMargePct = (v: number) => {
    const clamped = Math.max(0, Math.min(v, MARGE_MAX * 100));
    patch({ taux_marge: clamped / 100 });
  };

  // Alerte sur la marge APRÈS remise (le prix client baisse, le coût non).
  const niveau = margeNiveau(totaux.marge_pct);
  const margeApresPct = Math.round(totaux.marge_pct * 100);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Marge &amp; TVA</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Taux de marge (sur PV)"
            hint="PU vente HT = coût ÷ (1 − marge)"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={MARGE_MAX * 100}
                className="w-24 font-mono"
                value={margePct}
                onChange={(e) => setMargePct(Number(e.target.value) || 0)}
              />
              <span className="text-sm text-muted">%</span>
            </div>
          </Field>
          <Field
            label="Régime de TVA"
            hint={
              solaire
                ? "Piloté à l'étape Installation solaire (≤ 9 kWc + EMS + modules conformes)."
                : draft.entite === "MA"
                  ? "Maroc : 20 % (figé)."
                  : draft.mode_tva === "fr_autoliquidation"
                    ? "Tout le devis à 0 % — TVA due par le preneur."
                    : "Taux choisi par ligne dans l'aperçu (défaut 5,5 %)."
            }
          >
            {solaire ? (
              <div className="flex h-9 items-center rounded-lg border border-line bg-cream/50 px-3 text-sm text-ink">
                {pctTva(pvElig!.taux)}
                <span className="ml-2 text-muted">
                  {pvElig!.taux === 0.055 ? "— réduite (éligible)" : "— plein"}
                </span>
              </div>
            ) : draft.entite === "MA" ? (
              <div className="flex h-9 items-center rounded-lg border border-line bg-cream/50 px-3 text-sm text-muted">
                20 % — standard
              </div>
            ) : (
              <Select
                value={
                  draft.mode_tva === "fr_autoliquidation" ? "autoliq" : "ligne"
                }
                onChange={(e) =>
                  patch({
                    mode_tva:
                      e.target.value === "autoliq"
                        ? "fr_autoliquidation"
                        : "fr_5_5",
                  })
                }
              >
                <option value="ligne">Taux par ligne (5,5 / 10 / 20)</option>
                <option value="autoliq">Autoliquidation (B2B BTP)</option>
              </Select>
            )}
          </Field>
        </div>
      </section>

      {/* Lignes du devis — renommage, PU imposé, lignes libres (édition interne) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Lignes du devis</h3>
          <button
            type="button"
            onClick={addLigneLibre}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"
          >
            <Plus className="size-4" strokeWidth={2} />
            Ligne libre
          </button>
        </div>
        <p className="mb-2 text-[12px] text-muted">
          Renomme une ligne, impose un PU, ou ajoute une ligne hors catalogue. Un
          PU qui fait passer la marge sous {Math.round(SEUIL_MARGE_ALERTE * 100)} %
          est signalé (visible en interne uniquement).
        </p>
        <div className="overflow-hidden rounded-xl border border-line">
          {lignes.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted">
              Aucune ligne — compose le devis aux étapes précédentes, ou ajoute une
              ligne libre.
            </p>
          ) : (
            lignes.map((l) => {
              const free = l.article_id === null;
              const lineMarge = l.pu_ht > 0 ? (l.pu_ht - l.cout_ht) / l.pu_ht : 0;
              const sousSeuil = lineMarge < SEUIL_MARGE_ALERTE;
              const overridden =
                !free && l.article_id
                  ? draft.ligne_overrides[l.article_id]?.pu_ht != null
                  : false;
              return (
                <div key={l.article_id ?? l.id} className="border-b border-line px-3 py-2.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Input
                      value={l.designation}
                      onChange={(e) =>
                        free
                          ? updateLigneLibre(l.id, { designation: e.target.value })
                          : setLigneNom(l.article_id as string, e.target.value)
                      }
                    />
                    {free ? (
                      <button
                        type="button"
                        aria-label="Supprimer la ligne"
                        onClick={() => removeLigneLibre(l.id)}
                        className="shrink-0 text-muted transition-colors hover:text-alert"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                    <label className="flex items-center gap-1.5 text-muted">
                      Qté
                      {free ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-7 w-16 font-mono"
                          value={l.quantite}
                          onChange={(e) =>
                            updateLigneLibre(l.id, { quantite: Number(e.target.value) || 0 })
                          }
                        />
                      ) : (
                        <span className="font-mono text-ink">
                          {l.quantite} {UNITE_LABEL[l.unite]}
                        </span>
                      )}
                    </label>
                    <label className="flex items-center gap-1.5 text-muted">
                      PU HT
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-7 w-24 font-mono"
                        value={l.pu_ht}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          free
                            ? updateLigneLibre(l.id, { pu_ht: v })
                            : setLignePu(l.article_id as string, v);
                        }}
                      />
                    </label>
                    {overridden ? (
                      <button
                        type="button"
                        onClick={() => setLignePu(l.article_id as string, null)}
                        className="inline-flex items-center gap-1 text-brand"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={2} />
                        PU catalogue
                      </button>
                    ) : null}
                    <span
                      className={
                        sousSeuil
                          ? "inline-flex items-center gap-1 font-mono text-alert"
                          : "font-mono text-muted"
                      }
                    >
                      {sousSeuil ? <AlertTriangle className="size-3.5" strokeWidth={2} /> : null}
                      marge {Math.round(lineMarge * 100)} %
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Réduction commerciale
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <Field label="Type">
            <Segmented
              value={draft.remise_type}
              onChange={(v) =>
                patch({ remise_type: v as "percent" | "montant" })
              }
              options={[
                { value: "percent", label: "%" },
                { value: "montant", label: cfgEntite.symbole },
              ]}
            />
          </Field>
          <Field
            label={
              draft.remise_type === "percent"
                ? "Remise (% du HT)"
                : `Remise (HT, ${cfgEntite.symbole})`
            }
            hint="Déduite du HT avant TVA (I-14° CGI)."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={draft.remise_type === "percent" ? 100 : undefined}
              className="w-40 font-mono"
              value={draft.remise_valeur || ""}
              onChange={(e) =>
                patch({ remise_valeur: Number(e.target.value) || 0 })
              }
              placeholder="0"
            />
          </Field>
        </div>
        {draft.remise_valeur > 0 ? (
          <Field label="Motif (traçabilité)" className="mt-3">
            <Input
              value={draft.remise_motif}
              onChange={(e) => patch({ remise_motif: e.target.value })}
              placeholder="Geste commercial, parrainage…"
            />
          </Field>
        ) : null}
        {totaux.remise > 0 ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Remise appliquée : {m(totaux.remise)} → HT net {m(totaux.montant_ht)}
          </p>
        ) : null}
      </section>

      {/* Alerte marge — INTERNE uniquement (jamais sur le PDF / la vue client) */}
      {niveau !== "ok" ? (
        <div
          className={
            niveau === "perte"
              ? "flex items-start gap-2.5 rounded-xl border border-alert/40 bg-alert/8 px-4 py-3"
              : "flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3"
          }
        >
          <AlertTriangle
            className={
              niveau === "perte"
                ? "mt-0.5 size-4 shrink-0 text-alert"
                : "mt-0.5 size-4 shrink-0 text-gold-ink"
            }
            strokeWidth={2}
          />
          <div className="text-[13px]">
            {niveau === "perte" ? (
              <p className="font-semibold text-alert">
                Cette remise te fait vendre à perte : marge de{" "}
                <span className="font-mono">{margeApresPct}&nbsp;%</span>.
                L&apos;émission reste possible, mais en connaissance de cause.
              </p>
            ) : (
              <p className="font-semibold text-gold-ink">
                Marge à <span className="font-mono">{margeApresPct}&nbsp;%</span>,
                en dessous du seuil de 20&nbsp;%.
              </p>
            )}
            <p className="mt-0.5 text-muted">
              Le prix client baisse, ton coût de revient ne bouge pas.
            </p>
          </div>
        </div>
      ) : null}

      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink">
          Acomptes VDE (versements directs)
        </h3>
        <p className="mb-3 text-[13px] text-muted">
          Chaque échéance est un versement du client à VDE. 2 versements par
          défaut.
        </p>
        <Segmented
          value={draft.mode_paiement}
          onChange={(v) => patch({ mode_paiement: v as ModePaiement })}
          options={[
            { value: "50_50", label: "2 versements" },
            { value: "40_40_20", label: "3 versements" },
          ]}
        />
      </section>

      {/* Alma — mode de paiement par un tiers, FR UNIQUEMENT (pas d'Alma en MA) */}
      {draft.entite === "FR" ? (
        <section className="rounded-xl border border-line p-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand"
              checked={draft.alma_propose}
              onChange={(e) => patch({ alma_propose: e.target.checked })}
            />
            <span className="text-sm">
              <span className="font-semibold text-ink">
                Proposer le paiement en 2x / 3x / 4x (Alma)
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                Facilité affichée au client. Alma paie VDE en une fois : aucun
                solde à suivre côté VDE.
              </span>
            </span>
          </label>
          {draft.alma_propose ? (
            <div className="mt-3 pl-6">
              <Field label="Nombre d'échéances Alma">
                <Segmented
                  value={String(draft.alma_plan)}
                  onChange={(v) =>
                    patch({ alma_plan: Number(v) as 2 | 3 | 4 })
                  }
                  options={[
                    { value: "2", label: "2x" },
                    { value: "3", label: "3x" },
                    { value: "4", label: "4x" },
                  ]}
                />
              </Field>
              <p className="mt-2 font-mono text-xs text-muted">
                {almaPhrase(totaux.montant_ttc, draft.alma_plan, m)}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <Field label="Notes (bas de devis)">
          <Textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Précisions, conditions particulières…"
          />
        </Field>
      </section>

      {/* Récap chiffré (le détail vit dans l'aperçu). */}
      <section className="rounded-xl border border-line bg-cream/40 p-4">
        <div className="grid grid-cols-2 gap-3 font-mono text-sm sm:grid-cols-4">
          <Stat label="Total HT" value={m(totaux.montant_ht)} />
          <Stat label="TVA" value={m(totaux.montant_tva)} />
          <Stat label="Total TTC" value={m(totaux.montant_ttc)} strong />
          <Stat
            label="Marge"
            value={`${m(totaux.marge_euro)} · ${Math.round(totaux.marge_pct * 100)} %`}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={strong ? "text-base text-ink" : "text-sm text-ink"}>{value}</p>
    </div>
  );
}
