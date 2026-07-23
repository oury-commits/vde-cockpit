"use client";

import { useWizard } from "@/components/devis/context";
import { Segmented } from "@/components/devis/atoms";
import { QrProduit } from "@/components/devis/QrProduit";
import { UNITE_LABEL } from "@/lib/catalogue/meta";
import { entiteConfig, optionTva } from "@/lib/entite/config";
import { useEntreprise } from "@/lib/entreprise/EntrepriseProvider";
import { raisonSociale } from "@/lib/entreprise/document";
import { formatMontant } from "@/lib/format";
import {
  AIDE_TVA_FR,
  TAUX_TVA_FR,
  buildEcheancierPaiement,
} from "@/lib/devis/pricing";
import { MENTION_REMISE, remiseLabel } from "@/lib/devis/remise";
import { pctTva } from "@/lib/devis/tva";
import { MODE_PAIEMENT_LABEL } from "@/lib/devis/types";

const ECHEANCE_LABEL: Record<string, string> = {
  acompte: "Acompte",
  demarrage: "Démarrage",
  solde: "Solde",
};

export function DevisPreview() {
  const { draft, lignes, totaux, vue, setVue, setTauxLigne } = useWizard();
  const { fiche } = useEntreprise();
  const cfg = entiteConfig(draft.entite);
  const devise = cfg.devise;
  const m = (n: number) => formatMontant(n, devise, { cents: true });
  const interne = vue === "interne";

  const opt = optionTva(draft.entite, draft.mode_tva);
  const autoliq = draft.mode_tva === "fr_autoliquidation";
  // TVA choisissable par ligne : France, hors autoliquidation.
  const tvaParLigne = draft.entite === "FR" && !autoliq;

  const echeances = buildEcheancierPaiement(totaux.montant_ttc, draft.mode_paiement);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-serif text-lg italic text-ink">Aperçu</p>
          <p className="text-[11px] text-muted">{raisonSociale(fiche(draft.entite), draft.entite)}</p>
        </div>
        <Segmented
          size="sm"
          value={vue}
          onChange={setVue}
          options={[
            { value: "client", label: "Client" },
            { value: "interne", label: "Interne" },
          ]}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-sm font-medium text-ink">
          {draft.client.nom || "Client à renseigner"}
        </p>
        {(draft.client.code_postal || draft.client.ville) && (
          <p className="text-xs text-muted">
            {[draft.client.code_postal, draft.client.ville].filter(Boolean).join(" ")}
          </p>
        )}

        {lignes.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            Sélectionnez une borne et une pose à l'étape « Configuration » pour
            voir le devis se construire.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {lignes.map((l) => (
              <li key={l.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    {l.designation}
                    <span className="ml-1 text-xs text-muted">
                      {l.quantite > 1 || l.unite !== "u"
                        ? `· ${l.quantite} ${UNITE_LABEL[l.unite]}`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-sm text-ink">
                    {m(l.total_ht)}
                  </span>
                </div>
                {/* TVA de la ligne : éditable en FR (hors autoliq), sinon lue. */}
                <div className="mt-0.5 flex items-center justify-between text-[11px]">
                  {tvaParLigne && l.article_id ? (
                    <label className="flex items-center gap-1 text-muted">
                      TVA
                      <select
                        aria-label={`TVA — ${l.designation}`}
                        title={AIDE_TVA_FR}
                        value={l.taux_tva}
                        onChange={(e) =>
                          setTauxLigne(l.article_id!, Number(e.target.value))
                        }
                        className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-[11px] text-ink"
                      >
                        {TAUX_TVA_FR.map((o) => (
                          <option key={o.taux} value={o.taux}>
                            {o.court}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="font-mono text-muted">
                      TVA {autoliq ? "0 % (autoliq.)" : pctTva(l.taux_tva)}
                    </span>
                  )}
                </div>
                {interne ? (
                  <div className="mt-0.5 flex justify-between font-mono text-[11px] text-muted">
                    <span>
                      coût {m(l.cout_ht)} · marge {Math.round(l.taux_marge * 100)} %
                    </span>
                    <span>PU {m(l.pu_ht)}</span>
                  </div>
                ) : null}
                {l.url_produit ? <QrProduit url={l.url_produit} /> : null}
              </li>
            ))}
          </ul>
        )}

        {/* Totaux — ordre conforme : HT brut → remise → HT net → TVA → TTC */}
        <div className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-sm">
          {totaux.remise > 0 ? (
            <>
              <Row label="Total HT brut" value={m(totaux.montant_ht_brut)} />
              <Row
                // Même libellé que le PDF (helper partagé) — aperçu et document
                // ne peuvent pas formater la remise différemment.
                label={remiseLabel({
                  type: totaux.remise_type,
                  valeur: totaux.remise_valeur,
                  montant: totaux.remise,
                  motif: draft.remise_motif.trim() || null,
                })}
                value={`− ${m(totaux.remise)}`}
                tone="gold"
              />
              <Row label="Total HT net" value={m(totaux.montant_ht)} />
            </>
          ) : (
            <Row label="Total HT" value={m(totaux.montant_ht)} />
          )}
          {/* Ventilation par taux (Art. 242 nonies A) : une ligne base + TVA
              par taux distinct. Un seul taux → une seule ligne. */}
          {autoliq ? (
            <Row label="TVA — autoliquidation" value={m(0)} />
          ) : (
            totaux.ventilation.map((v) => (
              <Row
                key={v.taux}
                label={`TVA ${pctTva(v.taux)} · base ${m(v.base_ht)}`}
                value={m(v.montant_tva)}
              />
            ))
          )}
          {/* Aucune aide déduite : le TTC est le montant dû par le client. */}
          <Row label="Total TTC" value={m(totaux.montant_ttc)} strong />
        </div>

        {totaux.remise > 0 ? (
          <p className="mt-2 text-[11px] text-muted">{MENTION_REMISE}</p>
        ) : null}
        {totaux.ventilation.length > 1 ? (
          <p className="mt-2 text-[11px] text-muted">
            Document soumis à plusieurs taux de TVA — ventilation ci-dessus (Art.
            242 nonies A CGI).
          </p>
        ) : null}
        {opt.mention ? (
          <p className="mt-2 text-[11px] text-muted">{opt.mention}</p>
        ) : null}

        {/* Échéancier */}
        {totaux.montant_ttc > 0 ? (
          <div className="mt-4 rounded-lg bg-cream/50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Échéancier · {MODE_PAIEMENT_LABEL[draft.mode_paiement]}
            </p>
            <div className="mt-1.5 space-y-1 font-mono text-xs">
              {echeances.map((e) => (
                <div key={e.label} className="flex justify-between text-ink">
                  <span className="text-muted">
                    {e.pct} % · {ECHEANCE_LABEL[e.label]}
                  </span>
                  <span>{m(e.montant)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Marge — vue interne uniquement */}
        {interne && lignes.length > 0 ? (
          <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5 font-mono text-xs">
            <div className="flex justify-between text-muted">
              <span>Coût de revient total</span>
              <span className="text-ink">{m(totaux.cout_total)}</span>
            </div>
            <div className="mt-1 flex justify-between text-muted">
              <span>Marge</span>
              <span className="font-semibold text-success">
                {m(totaux.marge_euro)} · {Math.round(totaux.marge_pct * 100)} %
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "gold";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-ink" : "text-muted"}>{label}</span>
      <span
        className={
          tone === "gold"
            ? "text-gold-ink"
            : strong
              ? "font-semibold text-ink"
              : "text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
