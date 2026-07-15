"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useLeadsStore, type ImportReport } from "@/lib/leads/store";
import {
  IMPORT_FIELDS,
  guessMapping,
  parseCsv,
  rowsToDrafts,
  type Mapping,
} from "@/lib/leads/csv";
import { isSameContact } from "@/lib/leads/filters";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";

export function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useLeadsStore();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setReport(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("Fichier vide ou illisible.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(guessMapping(parsed.headers));
    } catch {
      setError("Impossible de lire le fichier.");
    }
  };

  const drafts = useMemo(
    () => (headers.length ? rowsToDrafts(headers, rows, mapping) : []),
    [headers, rows, mapping],
  );

  // Dry-run anti-doublon (tél/email déjà présents, ou en double dans le lot).
  const analysis = useMemo(() => {
    const seen: { telephone?: string | null; email?: string | null }[] = [];
    let dups = 0;
    let invalid = 0;
    for (const d of drafts) {
      if (!d.telephone.trim()) {
        invalid++;
        continue;
      }
      const dup =
        store.leads.some((l) => isSameContact(l, d)) ||
        seen.some((s) => isSameContact(s, d));
      if (dup) dups++;
      seen.push(d);
    }
    return { total: drafts.length, dups, invalid, valid: drafts.length - dups - invalid };
  }, [drafts, store.leads]);

  const canImport =
    Boolean(mapping.nom) && Boolean(mapping.telephone) && analysis.valid > 0;

  const doImport = () => {
    const valid = drafts.filter((d) => d.telephone.trim());
    setReport(store.importDrafts(valid));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importer des leads"
      description="CSV / Excel export Facebook — mapping, aperçu, anti-doublon."
      size="xl"
      footer={
        report ? (
          <Button onClick={handleClose}>Fermer</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Annuler
            </Button>
            <Button onClick={doImport} disabled={!canImport}>
              Importer {analysis.valid} lead{analysis.valid > 1 ? "s" : ""}
            </Button>
          </>
        )
      }
    >
      {report ? (
        <div className="py-4 text-center">
          <p className="font-mono text-3xl font-semibold text-success">
            {report.imported.length}
          </p>
          <p className="mt-1 text-sm text-ink">
            lead{report.imported.length > 1 ? "s" : ""} importé
            {report.imported.length > 1 ? "s" : ""}.
          </p>
          {report.duplicates.length > 0 ? (
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono">{report.duplicates.length}</span> doublon
              {report.duplicates.length > 1 ? "s" : ""} ignoré
              {report.duplicates.length > 1 ? "s" : ""} (téléphone/email déjà présent).
            </p>
          ) : null}
        </div>
      ) : headers.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-cream/40 px-6 py-12 text-center transition-colors hover:bg-cream">
          <span className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
            <Upload className="size-6" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">
            Choisir un fichier CSV
          </span>
          <span className="text-xs text-muted">
            Séparateur virgule ou point-virgule détecté automatiquement.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-4">
          {error ? <p className="text-sm text-alert">{error}</p> : null}

          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Correspondance des colonnes
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {IMPORT_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={`${f.label}${f.required ? " *" : ""}`}
                >
                  <Select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [f.key]: e.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">— ignorer —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-lg bg-cream/60 px-3 py-2 text-xs">
            <span className="text-ink">
              <span className="font-mono font-semibold">{analysis.total}</span> lignes
            </span>
            <span className="text-success">
              <span className="font-mono font-semibold">{analysis.valid}</span> à importer
            </span>
            <span className="text-gold-ink">
              <span className="font-mono font-semibold">{analysis.dups}</span> doublons
            </span>
            {analysis.invalid > 0 ? (
              <span className="text-alert">
                <span className="font-mono font-semibold">{analysis.invalid}</span> sans téléphone
              </span>
            ) : null}
          </div>

          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Aperçu (5 premières lignes)
            </h4>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream/60 text-muted">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Nom</th>
                    <th className="px-2.5 py-1.5 font-semibold">Téléphone</th>
                    <th className="px-2.5 py-1.5 font-semibold">Ville</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.slice(0, 5).map((d, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2.5 py-1.5 text-ink">{d.nom}</td>
                      <td className="px-2.5 py-1.5 font-mono text-ink">
                        {d.telephone || "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-muted">{d.ville || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
