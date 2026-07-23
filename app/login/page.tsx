"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage() {
  const { enabled, signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Message de retour (ex. après mise à jour du mot de passe), lu côté client
  // pour éviter useSearchParams + Suspense au prerender.
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("message") === "reset") {
      setInfo("Mot de passe mis à jour — connectez-vous.");
    }
  }, []);

  // Bloc « mot de passe oublié ».
  const [oubli, setOubli] = useState(false);
  const [emailOubli, setEmailOubli] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.replace("/dashboard");
  };

  const demanderLien = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    // On ignore volontairement le résultat : jamais révéler si l'email existe.
    await resetPassword(emailOubli);
    setEnvoi(false);
    setEnvoye(true);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-gold text-xl font-bold text-brand">
            V
          </div>
          <div>
            <h1 className="font-serif text-2xl italic text-ink">VDE Cockpit</h1>
            <p className="text-sm text-muted">Connexion à votre espace</p>
          </div>
        </div>

        {info ? (
          <div className="mb-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-sm text-success">
            {info}
          </div>
        ) : null}

        {!enabled ? (
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-ink">
            Authentification désactivée : renseignez les clés Supabase dans{" "}
            <span className="font-mono">.env.local</span> pour activer la
            connexion. En attendant, l&apos;application reste accessible en mode
            démonstration.
          </div>
        ) : oubli ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div>
              <h2 className="text-sm font-semibold text-ink">Mot de passe oublié</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                Entrez votre email : un lien de réinitialisation vous sera envoyé.
              </p>
            </div>
            {envoye ? (
              <p className="rounded-lg border border-success/30 bg-success/8 px-3 py-2.5 text-[13px] text-success">
                Si un compte existe pour cet email, un lien de réinitialisation
                vient d&apos;être envoyé. Pensez à vérifier les indésirables.
              </p>
            ) : (
              <form onSubmit={demanderLien} className="flex flex-col gap-3">
                <Field label="Email">
                  <Input
                    type="email"
                    value={emailOubli}
                    onChange={(e) => setEmailOubli(e.target.value)}
                    required
                    autoFocus
                    placeholder="prenom@visiondigitalenergies.fr"
                  />
                </Field>
                <Button type="submit" disabled={envoi || !emailOubli} className="w-full">
                  {envoi ? "Envoi…" : "Recevoir le lien"}
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={() => {
                setOubli(false);
                setEnvoye(false);
              }}
              className="text-[13px] text-brand underline"
            >
              ← Retour à la connexion
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          >
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Mot de passe">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error ? <p className="text-sm text-alert">{error}</p> : null}
            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
            <button
              type="button"
              onClick={() => setOubli(true)}
              className="mt-1 text-center text-[13px] text-brand underline"
            >
              Mot de passe oublié ?
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
