"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ForceMdp } from "@/components/auth/ForceMdp";
import { MIN_MDP } from "@/lib/auth/password";

export default function ResetPasswordPage() {
  const { enabled, session, updatePassword, signOut } = useAuth();
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le lien Supabase établit une session de RÉCUPÉRATION (détectée dans l'URL).
  // On laisse un court délai à cette détection avant de conclure « lien invalide »
  // pour éviter un faux négatif au chargement.
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (session) {
      setPret(true);
      return;
    }
    const t = setTimeout(() => setPret(true), 2000);
    return () => clearTimeout(t);
  }, [session]);

  const tropCourt = pw.length < MIN_MDP;
  const different = confirm.length > 0 && pw !== confirm;
  const peut = !tropCourt && pw === confirm && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!peut) return;
    setBusy(true);
    setErreur(null);
    const { error } = await updatePassword(pw);
    if (error) {
      setBusy(false);
      setErreur(error);
      return;
    }
    // Déconnexion pour forcer une reconnexion propre avec le nouveau mot de passe.
    await signOut();
    router.replace("/login?message=reset");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-gold text-xl font-bold text-brand">
            V
          </div>
          <div>
            <h1 className="font-serif text-2xl italic text-ink">Nouveau mot de passe</h1>
            <p className="text-sm text-muted">Choisissez un mot de passe sûr.</p>
          </div>
        </div>

        {!enabled ? (
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-ink">
            Authentification désactivée : la réinitialisation nécessite un backend
            Supabase configuré.
          </div>
        ) : session ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          >
            <Field label="Nouveau mot de passe" hint={`${MIN_MDP} caractères minimum`}>
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <ForceMdp pw={pw} />
            <Field label="Confirmer le mot de passe">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
            {different ? (
              <p className="text-[13px] text-alert">Les deux mots de passe diffèrent.</p>
            ) : null}
            {erreur ? <p className="text-sm text-alert">{erreur}</p> : null}
            <Button type="submit" disabled={!peut} className="mt-1 w-full">
              {busy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </Button>
          </form>
        ) : !pret ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm text-muted">
            Vérification du lien…
          </p>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
            <p className="text-sm text-ink">Lien invalide ou expiré.</p>
            <p className="text-[13px] text-muted">
              Les liens de réinitialisation ont une durée de vie limitée.
              Redemandez-en un depuis la page de connexion.
            </p>
            <Button onClick={() => router.replace("/login")} className="w-full">
              Redemander un lien
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
