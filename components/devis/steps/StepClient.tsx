"use client";

import { Field, Input } from "@/components/ui/Field";
import { CheckRow } from "@/components/devis/atoms";
import { useWizard } from "@/components/devis/context";

export function StepClient() {
  const { draft, patchClient, toggleConformite } = useWizard();
  const c = draft.client;
  const okCount = draft.conformite.filter((p) => p.ok).length;

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
          <h3 className="text-sm font-semibold text-ink">Conformité</h3>
          <span className="font-mono text-xs text-muted">{okCount}/6</span>
        </div>
        <div className="flex flex-col gap-2">
          {draft.conformite.map((p) => (
            <CheckRow
              key={p.key}
              checked={p.ok}
              onToggle={() => toggleConformite(p.key)}
              label={p.label}
            />
          ))}
        </div>
        {/* TODO: brancher données réelles — liste des points de conformité à
            valider avec Oury (proposition par défaut). */}
      </section>
    </div>
  );
}
