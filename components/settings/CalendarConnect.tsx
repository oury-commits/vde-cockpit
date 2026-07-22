"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";

interface Statut {
  connected: boolean;
  configured: boolean;
  calendars: { id: string; summary: string; primary?: boolean }[];
}

const RETOUR: Record<string, { ton: "ok" | "err"; texte: string }> = {
  connecte: { ton: "ok", texte: "Google Calendar connecté." },
  refuse: { ton: "err", texte: "Connexion refusée sur Google." },
  invalide: { ton: "err", texte: "Lien de connexion invalide ou expiré — réessaie." },
  echec: { ton: "err", texte: "Échec de la connexion à Google. Réessaie." },
  nonconfig: { ton: "err", texte: "Google Calendar n'est pas configuré côté serveur." },
};

export function CalendarConnect() {
  const { session, enabled } = useAuth();
  const [statut, setStatut] = useState<Statut | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Retour OAuth (?calendar=…) lu côté client — évite useSearchParams et son
  // besoin de Suspense au prerender.
  const [retourCle, setRetourCle] = useState<string | null>(null);
  useEffect(() => {
    setRetourCle(new URLSearchParams(window.location.search).get("calendar"));
  }, []);

  const token = session?.access_token ?? null;
  const retour = RETOUR[retourCle ?? ""];

  const auth = useCallback(
    (init: RequestInit = {}) => ({
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token ?? ""}` },
    }),
    [token],
  );

  const charger = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/calendar/status", auth());
      if (res.ok) setStatut((await res.json()) as Statut);
    } catch {
      /* réseau : on reste sur l'état courant */
    }
  }, [token, auth]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const connecter = async () => {
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/connect", auth({ method: "POST" }));
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Connexion impossible.");
      window.location.href = j.url; // → consentement Google
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Connexion impossible.");
      setBusy(false);
    }
  };

  const deconnecter = async () => {
    setBusy(true);
    try {
      await fetch("/api/calendar/disconnect", auth({ method: "POST" }));
      await charger();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarCheck className="size-4 text-brand" strokeWidth={1.75} />
        Google Calendar
      </h3>
      <p className="mt-1 text-sm text-muted">
        L&apos;agenda maître des tournées. Les RDV confirmés y sont créés
        automatiquement ; l&apos;occupation de l&apos;agenda bloque les créneaux
        côté planning. Un seul planning, jamais deux qui divergent.
      </p>

      {retour ? (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${
            retour.ton === "ok"
              ? "border border-success/30 bg-success/8 text-success"
              : "border border-alert/30 bg-alert/8 text-alert"
          }`}
        >
          {retour.texte}
        </p>
      ) : null}

      {!enabled || !token ? (
        <p className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Disponible une fois l&apos;authentification réelle activée et
          l&apos;utilisateur connecté (les jetons sont liés à ton compte).
        </p>
      ) : statut && !statut.configured ? (
        <p className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Connexion Google indisponible : identifiants OAuth serveur non
          configurés (à renseigner dans les variables d&apos;environnement).
        </p>
      ) : statut?.connected ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[13px] font-semibold text-success">
              <CalendarCheck className="size-3.5" strokeWidth={2} />
              Connecté
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={charger} disabled={busy}>
                Rafraîchir
              </Button>
              <Button variant="secondary" size="sm" icon={CalendarX} onClick={deconnecter} disabled={busy}>
                Déconnecter
              </Button>
            </div>
          </div>
          {statut.calendars.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {statut.calendars.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[13px] text-ink">
                  <span className="size-1.5 rounded-full bg-brand" />
                  {c.summary}
                  {c.primary ? <span className="text-[11px] text-muted">(principal)</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted">Aucun agenda listé.</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Button icon={CalendarCheck} onClick={connecter} disabled={busy || !statut}>
            {busy ? "Redirection…" : "Connecter Google Calendar"}
          </Button>
          {erreur ? <p className="mt-2 text-[13px] text-alert">{erreur}</p> : null}
        </div>
      )}
    </section>
  );
}
