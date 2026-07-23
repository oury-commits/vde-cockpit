"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ForceMdp } from "@/components/auth/ForceMdp";
import { MIN_MDP } from "@/lib/auth/password";

export function SecuriteMotDePasse() {
  const { enabled, session, updatePassword } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const tropCourt = pw.length < MIN_MDP;
  const different = confirm.length > 0 && pw !== confirm;
  const peut = !tropCourt && pw === confirm && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!peut) return;
    setBusy(true);
    setErreur(null);
    setOk(false);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) {
      setErreur(error);
      return;
    }
    setPw("");
    setConfirm("");
    setOk(true);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Lock className="size-4 text-brand" strokeWidth={1.75} />
        Sécurité
      </h3>
      <p className="mt-1 text-sm text-muted">
        Change ton mot de passe de connexion au cockpit.
      </p>

      {!enabled || !session ? (
        <p className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] text-gold-ink">
          Disponible une fois l&apos;authentification activée et l&apos;utilisateur
          connecté.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Field label="Nouveau mot de passe" hint={`${MIN_MDP} caractères minimum`}>
            <Input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setOk(false);
              }}
            />
          </Field>
          <ForceMdp pw={pw} />
          <Field label="Confirmer le mot de passe">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {different ? (
            <p className="text-[13px] text-alert">Les deux mots de passe diffèrent.</p>
          ) : null}
          {erreur ? <p className="text-[13px] text-alert">{erreur}</p> : null}
          {ok ? (
            <p className="flex items-center gap-1.5 text-[13px] text-success">
              <CircleCheck className="size-4 shrink-0" strokeWidth={2} />
              Mot de passe mis à jour.
            </p>
          ) : null}
          <Button type="submit" disabled={!peut} className="w-fit">
            {busy ? "Mise à jour…" : "Changer mon mot de passe"}
          </Button>
        </form>
      )}
    </section>
  );
}
