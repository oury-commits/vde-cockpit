"use client";

import { Check, QrCode } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Field";
import { CheckRow, Segmented } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { palierPose, suggestPoseId } from "@/lib/devis/builder";
import { puVenteHt } from "@/lib/devis/pricing";
import type { Reseau } from "@/lib/types";

export function StepConfig() {
  const { draft, articles, coutOf, patchConfig, toggleQr } = useWizard();
  const devise = entiteConfig(draft.entite).devise;
  const cfg = draft.config;

  const bornes = articles.filter((a) => a.categorie === "borne");
  const poses = articles.filter((a) => a.categorie === "pose");
  const tableaux = articles.filter((a) => a.categorie === "tableau");
  const terres = articles.filter((a) => a.categorie === "terre");

  // « Son prix » = le PU de vente HT qui apparaîtra sur le devis (pas le coût).
  const prix = (id: string | null) => {
    const a = articles.find((x) => x.id === id);
    return a
      ? formatMontant(puVenteHt(coutOf(a), draft.taux_marge), devise, { cents: true })
      : null;
  };

  const applyReseau = (reseau: Reseau) =>
    patchConfig({ reseau, pose_id: suggestPoseId(articles, reseau, cfg.distance_m) });
  const applyDistance = (distance_m: number) =>
    patchConfig({
      distance_m,
      pose_id: suggestPoseId(articles, cfg.reseau, distance_m),
    });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Borne</h3>
        <p className="mb-2 text-[13px] text-muted">
          Coche la borne — sa ligne et son prix s&apos;ajoutent au devis en direct.
        </p>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {bornes.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted">
              Catalogue vide : ajoute des bornes dans Catalogue pour les cocher ici.
            </p>
          ) : (
            bornes.map((b) => {
              const coche = cfg.borne_id === b.id;
              const bQr = draft.qr_articles.includes(b.id);
              return (
                <div key={b.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => patchConfig({ borne_id: coche ? null : b.id })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cream/50"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                        coche ? "border-brand bg-brand text-cream" : "border-line text-transparent"
                      }`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink">{b.designation}</span>
                    <span className="shrink-0 font-mono text-[13px] text-ink">
                      {formatMontant(puVenteHt(coutOf(b), draft.taux_marge), devise, { cents: true })}
                    </span>
                  </button>
                  {coche && b.url_produit ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-line/60 bg-cream/30 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleQr(b.id)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-brand"
                      >
                        <QrCode className="size-4" strokeWidth={1.75} />
                        {bQr ? "QR affiché sur le devis" : "Afficher le QR sur le devis"}
                      </button>
                      <a
                        href={b.url_produit}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-brand underline"
                      >
                        Voir la fiche produit
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Pose</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Réseau">
            <Segmented
              value={cfg.reseau}
              onChange={applyReseau}
              options={[
                { value: "mono", label: "Monophasé" },
                { value: "tri", label: "Triphasé" },
              ]}
            />
          </Field>
          <Field
            label="Distance tableau → borne (m)"
            hint={`Palier P${palierPose(cfg.distance_m)}`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              className="font-mono"
              value={cfg.distance_m}
              onChange={(e) => applyDistance(Number(e.target.value) || 0)}
            />
          </Field>
          <Field
            label="Forfait de pose"
            className="sm:col-span-2"
            hint={prix(cfg.pose_id) ? `Prix HT ${prix(cfg.pose_id)}` : "Auto-suggéré depuis la distance et le réseau"}
          >
            <Select
              value={cfg.pose_id ?? ""}
              onChange={(e) => patchConfig({ pose_id: e.target.value || null })}
            >
              <option value="">— Aucun forfait —</option>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.designation}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Tableau &amp; mise à la terre
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tableau électrique" hint={prix(cfg.tableau_id) ? `Prix HT ${prix(cfg.tableau_id)}` : undefined}>
            <Select
              value={cfg.tableau_id ?? ""}
              onChange={(e) => patchConfig({ tableau_id: e.target.value || null })}
            >
              <option value="">— Aucun —</option>
              {tableaux.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.designation}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mise à la terre" hint={prix(cfg.terre_id) ? `Prix HT ${prix(cfg.terre_id)}` : undefined}>
            <Select
              value={cfg.terre_id ?? ""}
              onChange={(e) => patchConfig({ terre_id: e.target.value || null })}
            >
              <option value="">— Aucune —</option>
              {terres.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.designation}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Administratif</h3>
        <div className="flex flex-col gap-2">
          <CheckRow
            checked={cfg.consuel}
            onToggle={() => patchConfig({ consuel: !cfg.consuel })}
            label="Attestation Consuel IRVE"
          />
          <CheckRow
            checked={cfg.schema}
            onToggle={() => patchConfig({ schema: !cfg.schema })}
            label="Schéma électrique"
          />
        </div>
      </section>
    </div>
  );
}
