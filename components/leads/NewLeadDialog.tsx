"use client";

import { useState } from "react";
import type { Lead, Puissance, TypeLogement } from "@/lib/types";
import { useLeadsStore, type LeadInput } from "@/lib/leads/store";
import { useEntity } from "@/lib/entite/EntityProvider";
import { ENTITE_LABEL } from "@/lib/entite/config";
import {
  MEMBRES,
  PUISSANCE_LABEL,
  TYPE_LOGEMENT_LABEL,
} from "@/lib/leads/meta";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

const EMPTY: LeadInput = { nom: "", telephone: "", canal: "manuel" };

export function NewLeadDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}) {
  const store = useLeadsStore();
  const { entiteForCreate } = useEntity();
  const [form, setForm] = useState<LeadInput>(EMPTY);
  const [duplicate, setDuplicate] = useState<Lead | null>(null);

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const close = () => {
    setForm(EMPTY);
    setDuplicate(null);
    onClose();
  };

  const submit = () => {
    if (!form.nom.trim() || !form.telephone.trim()) return;
    const { lead, duplicate: dup } = store.addLead({
      ...form,
      entite: entiteForCreate,
    });
    if (!lead) {
      setDuplicate(dup ?? null);
      return;
    }
    setForm(EMPTY);
    onCreated(lead);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nouveau lead"
      description={`Entité ${ENTITE_LABEL[entiteForCreate]} — ref FB-XXX attribuée automatiquement.`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={!form.nom.trim() || !form.telephone.trim()}
          >
            Créer le lead
          </Button>
        </>
      }
    >
      {duplicate ? (
        <p className="mb-3 rounded-lg border border-alert/30 bg-alert/5 px-3 py-2 text-sm text-alert">
          Doublon détecté : ce contact existe déjà (
          <span className="font-mono">{duplicate.id}</span> — {duplicate.nom}).
          Modifiez le téléphone/email ou ouvrez la fiche existante.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom *">
          <Input
            value={form.nom}
            onChange={(e) => set("nom", e.target.value)}
            placeholder="Nom du prospect"
          />
        </Field>
        <Field label="Téléphone *">
          <Input
            value={form.telephone}
            onChange={(e) => set("telephone", e.target.value)}
            placeholder="06 …"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Source / campagne">
          <Input
            value={form.source_campagne ?? ""}
            onChange={(e) => set("source_campagne", e.target.value)}
          />
        </Field>
        <Field label="Code postal">
          <Input
            value={form.code_postal ?? ""}
            onChange={(e) => set("code_postal", e.target.value)}
          />
        </Field>
        <Field label="Ville">
          <Input
            value={form.ville ?? ""}
            onChange={(e) => set("ville", e.target.value)}
          />
        </Field>
        <Field label="Type de logement">
          <Select
            value={form.type_logement ?? ""}
            onChange={(e) =>
              set("type_logement", (e.target.value || undefined) as TypeLogement)
            }
          >
            <option value="">—</option>
            {(Object.keys(TYPE_LOGEMENT_LABEL) as TypeLogement[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LOGEMENT_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Puissance souhaitée">
          <Select
            value={form.puissance_souhaitee ?? ""}
            onChange={(e) =>
              set("puissance_souhaitee", (e.target.value || undefined) as Puissance)
            }
          >
            <option value="">—</option>
            {(Object.keys(PUISSANCE_LABEL) as Puissance[]).map((p) => (
              <option key={p} value={p}>
                {PUISSANCE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type de véhicule">
          <Input
            value={form.type_vehicule ?? ""}
            onChange={(e) => set("type_vehicule", e.target.value)}
          />
        </Field>
        <Field label="Distance tableau (m)">
          <Input
            type="number"
            value={form.distance_tableau ?? ""}
            onChange={(e) =>
              set(
                "distance_tableau",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </Field>
        <Field label="Montant estimé (€)">
          <Input
            type="number"
            value={form.montant_estime ?? ""}
            onChange={(e) =>
              set(
                "montant_estime",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </Field>
        {/* eligible_advenir retiré du formulaire : renseigné par l'import CSV,
            exploité par le scoring — jamais affiché ni saisi à la main. */}
        <Field label="Assigné à">
          <Select
            value={form.assigne_a ?? ""}
            onChange={(e) => set("assigne_a", e.target.value || null)}
          >
            <option value="">Non assigné</option>
            {MEMBRES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
