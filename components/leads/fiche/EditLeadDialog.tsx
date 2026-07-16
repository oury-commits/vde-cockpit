"use client";

import { useState } from "react";
import type {
  Emplacement,
  Fixation,
  Lead,
  Occupation,
  Puissance,
  PvProjet,
  Reseau,
  TypeLogement,
} from "@/lib/types";
import { useLeadsStore } from "@/lib/leads/store";
import { scoreTemperature } from "@/lib/leads/scoring";
import {
  EMPLACEMENT_LABEL,
  FIXATION_LABEL,
  MEMBRES,
  OCCUPATION_LABEL,
  PUISSANCE_LABEL,
  PV_PROJET_LABEL,
  RESEAU_LABEL,
  TYPE_LOGEMENT_LABEL,
} from "@/lib/leads/meta";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function EditLeadDialog({
  lead,
  open,
  onClose,
}: {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}) {
  const store = useLeadsStore();
  const [form, setForm] = useState<Lead>(lead);
  const set = <K extends keyof Lead>(key: K, value: Lead[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => (v === "" ? null : Number(v));

  const save = () => {
    const patch: Partial<Lead> = {
      ...form,
      temperature: scoreTemperature(form),
    };
    store.updateLead(lead.id, patch);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifier le lead"
      description={lead.id}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!form.nom.trim() || !form.telephone.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Section title="Contact">
        <Field label="Nom">
          <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
        </Field>
        <Field label="Source / campagne">
          <Input
            value={form.source_campagne ?? ""}
            onChange={(e) => set("source_campagne", e.target.value || null)}
          />
        </Field>
        <Field label="Code postal">
          <Input value={form.code_postal ?? ""} onChange={(e) => set("code_postal", e.target.value || null)} />
        </Field>
        <Field label="Ville">
          <Input value={form.ville ?? ""} onChange={(e) => set("ville", e.target.value || null)} />
        </Field>
        <Field label="Assigné à">
          <Select value={form.assigne_a ?? ""} onChange={(e) => set("assigne_a", e.target.value || null)}>
            <option value="">Non assigné</option>
            {MEMBRES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Réseau électrique">
        <Field label="Réseau">
          <Select value={form.reseau ?? ""} onChange={(e) => set("reseau", (e.target.value || null) as Reseau | null)}>
            <option value="">—</option>
            {(Object.keys(RESEAU_LABEL) as Reseau[]).map((r) => (
              <option key={r} value={r}>{RESEAU_LABEL[r]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Puissance compteur (kVA)">
          <Input
            type="number"
            value={form.puissance_compteur_kva ?? ""}
            onChange={(e) => set("puissance_compteur_kva", num(e.target.value))}
          />
        </Field>
      </Section>

      <Section title="Le bien">
        <Field label="Type de logement">
          <Select value={form.type_logement ?? ""} onChange={(e) => set("type_logement", (e.target.value || null) as TypeLogement | null)}>
            <option value="">—</option>
            {(Object.keys(TYPE_LOGEMENT_LABEL) as TypeLogement[]).map((t) => (
              <option key={t} value={t}>{TYPE_LOGEMENT_LABEL[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Occupation">
          <Select value={form.occupation ?? ""} onChange={(e) => set("occupation", (e.target.value || null) as Occupation | null)}>
            <option value="">—</option>
            {(Object.keys(OCCUPATION_LABEL) as Occupation[]).map((o) => (
              <option key={o} value={o}>{OCCUPATION_LABEL[o]}</option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="La pose">
        <Field label="Emplacement">
          <Select value={form.emplacement ?? ""} onChange={(e) => set("emplacement", (e.target.value || null) as Emplacement | null)}>
            <option value="">—</option>
            {(Object.keys(EMPLACEMENT_LABEL) as Emplacement[]).map((v) => (
              <option key={v} value={v}>{EMPLACEMENT_LABEL[v]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fixation">
          <Select value={form.fixation ?? ""} onChange={(e) => set("fixation", (e.target.value || null) as Fixation | null)}>
            <option value="">—</option>
            {(Object.keys(FIXATION_LABEL) as Fixation[]).map((v) => (
              <option key={v} value={v}>{FIXATION_LABEL[v]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Distance tableau (m)">
          <Input type="number" value={form.distance_tableau ?? ""} onChange={(e) => set("distance_tableau", num(e.target.value))} />
        </Field>
        <Field label="Obstacles">
          <Input value={form.obstacles ?? ""} onChange={(e) => set("obstacles", e.target.value || null)} />
        </Field>
      </Section>

      <Section title="Le projet">
        <Field label="Véhicule électrique">
          <Input value={form.type_vehicule ?? ""} onChange={(e) => set("type_vehicule", e.target.value || null)} />
        </Field>
        <Field label="Puissance souhaitée">
          <Select value={form.puissance_souhaitee ?? ""} onChange={(e) => set("puissance_souhaitee", (e.target.value || null) as Puissance | null)}>
            <option value="">—</option>
            {(Object.keys(PUISSANCE_LABEL) as Puissance[]).map((p) => (
              <option key={p} value={p}>{PUISSANCE_LABEL[p]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Éligible ADVENIR">
          <Select
            value={form.eligible_advenir == null ? "" : form.eligible_advenir ? "oui" : "non"}
            onChange={(e) => set("eligible_advenir", e.target.value === "" ? null : e.target.value === "oui")}
          >
            <option value="">—</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </Select>
        </Field>
        <Field label="Budget (réponse formulaire)">
          <Input value={form.budget ?? ""} onChange={(e) => set("budget", e.target.value || null)} />
        </Field>
        <Field label="Délai">
          <Input value={form.delai ?? ""} onChange={(e) => set("delai", e.target.value || null)} />
        </Field>
        <Field label="Montant estimé (€)">
          <Input type="number" value={form.montant_estime ?? ""} onChange={(e) => set("montant_estime", num(e.target.value))} />
        </Field>
        <Field label="Panneaux solaires">
          <Select value={form.pv_projet ?? ""} onChange={(e) => set("pv_projet", (e.target.value || null) as PvProjet | null)}>
            <option value="">—</option>
            {(Object.keys(PV_PROJET_LABEL) as PvProjet[]).map((v) => (
              <option key={v} value={v}>{PV_PROJET_LABEL[v]}</option>
            ))}
          </Select>
        </Field>
        {form.pv_projet === "autre" ? (
          <Field label="Précision solaire">
            <Input value={form.pv_autre ?? ""} onChange={(e) => set("pv_autre", e.target.value || null)} />
          </Field>
        ) : null}
      </Section>

      <Section title="Suivi">
        <Field label="Prochaine action">
          <Input value={form.prochaine_action ?? ""} onChange={(e) => set("prochaine_action", e.target.value || null)} />
        </Field>
        <Field label="Date de relance">
          <Input
            type="date"
            value={form.date_relance ? form.date_relance.slice(0, 10) : ""}
            onChange={(e) => set("date_relance", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
        </Field>
      </Section>
    </Modal>
  );
}
