"use client";

import { forceMotDePasse } from "@/lib/auth/password";

/** Indicateur de force basique (4 segments) sous un champ mot de passe. */
export function ForceMdp({ pw }: { pw: string }) {
  if (!pw) return null;
  const { score, label } = forceMotDePasse(pw);
  const couleur = score >= 3 ? "bg-success" : score === 2 ? "bg-gold" : "bg-alert";
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? couleur : "bg-line"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted">Force : {label}</p>
    </div>
  );
}
