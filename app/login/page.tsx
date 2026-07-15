"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage() {
  const { enabled, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.replace("/dashboard");
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

        {!enabled ? (
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-ink">
            Authentification désactivée : renseignez les clés Supabase dans{" "}
            <span className="font-mono">.env.local</span> pour activer la
            connexion. En attendant, l'application reste accessible en mode
            démonstration.
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
          </form>
        )}
      </div>
    </div>
  );
}
