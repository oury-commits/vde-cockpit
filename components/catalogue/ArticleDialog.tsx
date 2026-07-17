"use client";

import { useEffect, useState } from "react";
import type { Entite } from "@/lib/types";
import type {
  CatalogueArticle,
  CategorieArticle,
  Unite,
} from "@/lib/catalogue/types";
import { useCatalogueStore } from "@/lib/catalogue/store";
import {
  CATEGORIE_LABEL,
  CATEGORIE_ORDER,
  UNITE_LABEL,
} from "@/lib/catalogue/meta";
import { ENTITE_LABEL, entiteConfig } from "@/lib/entite/config";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const UNITES: Unite[] = ["u", "forfait", "m"];

interface FormState {
  designation: string;
  categorie: CategorieArticle;
  unite: Unite;
  cout_ht: string;
  a_confirmer: boolean;
  inclus_defaut: boolean;
  actif: boolean;
  note: string;
}

function initial(article: CatalogueArticle | null | undefined): FormState {
  return {
    designation: article?.designation ?? "",
    categorie: article?.categorie ?? "borne",
    unite: article?.unite ?? "u",
    cout_ht: article ? String(article.cout_ht) : "",
    a_confirmer: article?.a_confirmer ?? false,
    inclus_defaut: article?.inclus_defaut ?? false,
    actif: article?.actif ?? true,
    note: article?.note ?? "",
  };
}

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/15";
const LABEL = "mb-1 block text-xs font-medium text-muted";

export function ArticleDialog({
  open,
  onClose,
  entite,
  article,
}: {
  open: boolean;
  onClose: () => void;
  entite: Entite;
  article?: CatalogueArticle | null;
}) {
  const store = useCatalogueStore();
  const [form, setForm] = useState<FormState>(() => initial(article));

  // Réinitialise à l'ouverture (ou quand l'article édité change).
  useEffect(() => {
    if (open) setForm(initial(article));
  }, [open, article]);

  const isEdit = !!article;
  const devise = entiteConfig(entite).devise;
  const symbole = devise === "MAD" ? "DH" : "€";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const cout = Number(form.cout_ht.replace(",", "."));
  const valid = form.designation.trim().length > 0 && Number.isFinite(cout);

  const submit = () => {
    if (!valid) return;
    const payload = {
      designation: form.designation.trim(),
      categorie: form.categorie,
      unite: form.unite,
      cout_ht: cout,
      a_confirmer: form.a_confirmer,
      inclus_defaut: form.inclus_defaut,
      note: form.note.trim() || null,
    };
    if (article) {
      store.updateArticle(article.id, { ...payload, actif: form.actif });
    } else {
      store.addArticle({ ...payload, entite, actif: true });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier l'article" : "Nouvel article"}
      description={`Catalogue ${ENTITE_LABEL[entite]} · coût de revient HT en ${symbole}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {isEdit ? "Enregistrer" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className={LABEL} htmlFor="art-designation">
            Désignation
          </label>
          <input
            id="art-designation"
            className={FIELD}
            value={form.designation}
            onChange={(e) => set("designation", e.target.value)}
            placeholder="Ex. Pose P2 · 5-10 m · Monophasé"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="art-categorie">
              Catégorie
            </label>
            <select
              id="art-categorie"
              className={FIELD}
              value={form.categorie}
              onChange={(e) =>
                set("categorie", e.target.value as CategorieArticle)
              }
            >
              {CATEGORIE_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIE_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="art-unite">
              Unité
            </label>
            <select
              id="art-unite"
              className={FIELD}
              value={form.unite}
              onChange={(e) => set("unite", e.target.value as Unite)}
            >
              {UNITES.map((u) => (
                <option key={u} value={u}>
                  {UNITE_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="art-cout">
            Coût de revient HT ({symbole})
          </label>
          <input
            id="art-cout"
            inputMode="decimal"
            className={`${FIELD} font-mono`}
            value={form.cout_ht}
            onChange={(e) => set("cout_ht", e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="art-note">
            Note (optionnel)
          </label>
          <input
            id="art-note"
            className={FIELD}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Précision interne…"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line bg-cream/40 p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={form.a_confirmer}
              onChange={(e) => set("a_confirmer", e.target.checked)}
            />
            Prix à confirmer
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={form.inclus_defaut}
              onChange={(e) => set("inclus_defaut", e.target.checked)}
            />
            Inclus par défaut dans le devis
          </label>
          {isEdit ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={form.actif}
                onChange={(e) => set("actif", e.target.checked)}
              />
              Actif (décocher pour désactiver sans supprimer)
            </label>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
