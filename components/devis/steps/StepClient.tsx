"use client";

import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { useWizard } from "@/components/devis/context";
import { cn } from "@/lib/cn";

export function StepClient() {
  const { draft, patchClient, controle, toggleControle } = useWizard();
  const c = draft.client;
  const okCount = controle.filter((p) => p.conforme).length;
  const conforme = okCount === controle.length;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Client</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom" className="sm:col-span-2">
            <Input
              value={c.nom}
              onChange={(e) => patchClient({ nom: e.target.value })}
              placeholder="Nom du client"
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={c.telephone}
              onChange={(e) => patchClient({ telephone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <Input
              value={c.email}
              onChange={(e) => patchClient({ email: e.target.value })}
            />
          </Field>
          <Field label="Adresse" className="sm:col-span-2">
            <Input
              value={c.adresse}
              onChange={(e) => patchClient({ adresse: e.target.value })}
            />
          </Field>
          <Field label="Code postal">
            <Input
              value={c.code_postal}
              onChange={(e) => patchClient({ code_postal: e.target.value })}
            />
          </Field>
          <Field label="Ville">
            <Input
              value={c.ville}
              onChange={(e) => patchClient({ ville: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="size-4 text-brand" strokeWidth={1.75} />
            Contrôle technique
          </h3>
          <span className="font-mono text-xs text-muted">
            {okCount}/{controle.length} conformes
          </span>
        </div>

        {!conforme ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/8 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-alert"
              strokeWidth={2}
            />
            <p className="text-sm font-medium text-alert">
              Installation non conforme — ne pas installer. La validation du
              devis est bloquée tant qu'un point est en erreur.
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-line">
          {controle.map((p, i) => (
            <div
              key={p.key}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                i > 0 && "border-t border-line",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{p.label}</span>
                <span className="block font-mono text-xs text-muted">
                  {p.valeur}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggleControle(p.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  p.conforme
                    ? "bg-success/12 text-success hover:bg-success/20"
                    : "bg-alert/12 text-alert hover:bg-alert/20",
                )}
              >
                {p.conforme ? (
                  <>
                    <Check className="size-3" strokeWidth={3} /> OK
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-3" strokeWidth={2.5} /> ERREUR
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Valeurs pré-calculées depuis le type d'installation. Attestation
          Consuel obligatoire (IRVE &gt; 3,7 kW).
        </p>
        {/* TODO: brancher données réelles — barème de protections VDE à valider. */}
      </section>
    </div>
  );
}
