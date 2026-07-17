"use client";

import { Field, Input, Select } from "@/components/ui/Field";
import { CheckRow, Segmented } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { entiteConfig } from "@/lib/entite/config";
import { formatMontant } from "@/lib/format";
import { palierPose, suggestPoseId } from "@/lib/devis/builder";
import type { Reseau } from "@/lib/types";

export function StepConfig() {
  const { draft, articles, coutOf, patchConfig } = useWizard();
  const devise = entiteConfig(draft.entite).devise;
  const cfg = draft.config;

  const bornes = articles.filter((a) => a.categorie === "borne");
  const poses = articles.filter((a) => a.categorie === "pose");
  const tableaux = articles.filter((a) => a.categorie === "tableau");
  const terres = articles.filter((a) => a.categorie === "terre");

  const cout = (id: string | null) => {
    const a = articles.find((x) => x.id === id);
    return a ? formatMontant(coutOf(a), devise, { cents: true }) : null;
  };

  // Réseau / distance re-suggèrent automatiquement la ligne de pose.
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
        <h3 className="mb-3 text-sm font-semibold text-ink">Borne</h3>
        <Field label="Modèle" hint={cout(cfg.borne_id) ? `Coût de revient ${cout(cfg.borne_id)}` : undefined}>
          <Select
            value={cfg.borne_id ?? ""}
            onChange={(e) => patchConfig({ borne_id: e.target.value || null })}
          >
            <option value="">— Choisir une borne —</option>
            {bornes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.designation}
              </option>
            ))}
          </Select>
        </Field>
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
            hint={cout(cfg.pose_id) ? `Coût de revient ${cout(cfg.pose_id)}` : "Auto-suggéré depuis la distance et le réseau"}
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
          <Field label="Tableau électrique" hint={cout(cfg.tableau_id) ? `Coût de revient ${cout(cfg.tableau_id)}` : undefined}>
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
          <Field label="Mise à la terre" hint={cout(cfg.terre_id) ? `Coût de revient ${cout(cfg.terre_id)}` : undefined}>
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
