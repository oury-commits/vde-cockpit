"use client";

import { useMemo } from "react";
import { AlertTriangle, Check, ShieldCheck, Sun, Zap } from "lucide-react";
import { QtyStepper, Segmented } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";
import { CATEGORIE_LABEL, CATEGORIE_ORDER_SOLAIRE, UNITE_LABEL } from "@/lib/catalogue/meta";
import { entiteConfig } from "@/lib/entite/config";
import { puVenteHt } from "@/lib/devis/pricing";
import {
  PACKS_SOLAIRE,
  SEUIL_KWC_TVA,
  pvEligibilite,
} from "@/lib/devis/solaire";
import { formatMontant } from "@/lib/format";

export function StepSolaire() {
  const { draft, articles, coutOf, setSupplement, toggleSupplement, applyPack, patchPv } =
    useWizard();
  const devise = entiteConfig(draft.entite).devise;
  const elig = pvEligibilite(draft, articles);

  const qtyOf = (id: string) =>
    draft.supplements.find((s) => s.article_id === id)?.quantite ?? 0;

  // Catalogue solaire (domaine solaire), groupé dans l'ordre d'un devis PV.
  const groups = useMemo(
    () =>
      CATEGORIE_ORDER_SOLAIRE.map((cat) => ({
        cat,
        items: articles.filter((a) => a.domaine === "solaire" && a.categorie === cat),
      })).filter((g) => g.items.length > 0),
    [articles],
  );

  const kwcFmt = new Intl.NumberFormat("fr-FR").format(elig.kwc);

  return (
    <div className="flex flex-col gap-6">
      {/* Points de départ (packs modifiables) */}
      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <Sun className="size-4 text-brand" strokeWidth={1.75} />
          Points de départ
        </h3>
        <p className="mb-3 text-[13px] text-muted">
          Une base pré-cochée, calée pour rester ≤ {SEUIL_KWC_TVA} kWc (TVA 5,5 %).
          À ajuster ensuite article par article — rien n&apos;est figé.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PACKS_SOLAIRE.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPack(p)}
              className="flex flex-col items-start gap-1 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-brand/40 hover:bg-cream/40"
            >
              <span className="font-mono text-sm font-semibold text-brand">{p.label}</span>
              <span className="text-[12px] text-muted">{p.detail}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Type de projet */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Type de projet</h3>
        <Segmented
          value={draft.pv.autoconsommation}
          onChange={(v) => patchPv({ autoconsommation: v as "totale" | "avec_surplus" })}
          options={[
            { value: "totale", label: "Autoconsommation totale" },
            { value: "avec_surplus", label: "Avec vente du surplus" },
          ]}
        />
        <p className="mt-1.5 text-[12px] text-muted">
          Rachat du surplus ≈ 0,011 €/kWh en 2026 : l&apos;autoconsommation est le
          levier d&apos;économie. Le surplus ne rapporte quasi rien.
        </p>
      </section>

      {/* À la carte */}
      <section className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Composition à la carte</h3>
          <p className="text-[13px] text-muted">
            Coche un article — sa ligne et son prix de vente s&apos;ajoutent au devis
            en direct. Ajuste la quantité (panneaux, pose par kWc…).
          </p>
        </div>
        {groups.map(({ cat, items }) => (
          <section key={cat}>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              {CATEGORIE_LABEL[cat]}
            </h4>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {items.map((a) => {
                const qty = qtyOf(a.id);
                const coche = qty > 0;
                const pv = formatMontant(puVenteHt(coutOf(a), draft.taux_marge), devise, {
                  cents: true,
                });
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
                  >
                    <button
                      type="button"
                      aria-pressed={coche}
                      onClick={() => toggleSupplement(a.id)}
                      className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                        coche ? "border-brand bg-brand text-cream" : "border-line text-transparent"
                      }`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{a.designation}</span>
                      <span className="block font-mono text-xs text-muted">
                        {pv} / {UNITE_LABEL[a.unite]}
                        {a.puissance_wc ? ` · ${a.puissance_wc} Wc` : ""}
                      </span>
                    </span>
                    {coche ? (
                      <QtyStepper value={qty} onChange={(v) => setSupplement(a.id, v)} min={1} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      {/* Éligibilité TVA 5,5 % */}
      <section className="rounded-2xl border border-line bg-cream/40 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-brand" strokeWidth={1.75} />
          TVA 5,5 % — éligibilité
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Critere
            ok={elig.kwc > 0 && elig.kwc <= SEUIL_KWC_TVA}
            label="Puissance"
            valeur={`${kwcFmt} kWc`}
            hint={`≤ ${SEUIL_KWC_TVA} kWc`}
          />
          <Critere ok={elig.ems} label="Gestionnaire EMS" valeur={elig.ems ? "présent" : "absent"} hint="obligatoire" />
          <Critere
            ok={elig.modules_conformes}
            label="Modules conformes"
            valeur={elig.modules_conformes ? "attestés" : "non cochés"}
            hint="ACV / PEP"
          />
        </div>

        <label className="mt-3 flex items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand"
            checked={draft.pv.modules_conformes}
            onChange={(e) => patchPv({ modules_conformes: e.target.checked })}
          />
          <span className="text-[13px] text-ink">
            <span className="font-semibold">Modules conformes</span> — j&apos;atteste
            de l&apos;empreinte carbone &lt; 530 kg CO₂/kWc, argent &lt; 14 mg/W,
            plomb &lt; 0,1 %, cadmium &lt; 0,01 % (attestation ACV/PEP fournisseur).
          </span>
        </label>

        <label
          className={`mt-2 flex items-start gap-2.5 ${
            elig.eligible ? "" : "opacity-50"
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand disabled:opacity-40"
            checked={draft.pv.tva_reduite && elig.eligible}
            disabled={!elig.eligible}
            onChange={(e) => patchPv({ tva_reduite: e.target.checked })}
          />
          <span className="text-[13px] text-ink">
            <span className="font-semibold">Appliquer la TVA 5,5 %</span> — activable
            uniquement si les trois critères ci-dessus sont réunis.
          </span>
        </label>

        {/* Verdict */}
        {elig.kwc > SEUIL_KWC_TVA ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2 text-[13px] text-alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            Puissance &gt; {SEUIL_KWC_TVA} kWc : TVA 20 % automatique (hors barème résidentiel réduit).
          </p>
        ) : !elig.eligible && draft.pv.tva_reduite === false ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[13px] text-gold-ink">
            <Zap className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            Pour la TVA 5,5 %, il manque : {elig.manquants.join(", ")}. Sinon 20 %.
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-2 font-mono text-[13px] text-ink">
            Taux appliqué :{" "}
            <span className={elig.taux === 0.055 ? "text-success" : "text-ink"}>
              {new Intl.NumberFormat("fr-FR").format(elig.taux * 100)} %
            </span>
          </p>
        )}
      </section>
    </div>
  );
}

function Critere({
  ok,
  label,
  valeur,
  hint,
}: {
  ok: boolean;
  label: string;
  valeur: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {ok ? (
          <Check className="size-3.5 text-success" strokeWidth={3} />
        ) : (
          <AlertTriangle className="size-3.5 text-gold-ink" strokeWidth={2} />
        )}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm text-ink">{valeur}</p>
      <p className="text-[10px] text-muted">{hint}</p>
    </div>
  );
}
