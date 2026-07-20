"use client";

import { useState } from "react";
import { ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useProfiles } from "@/lib/roles/ProfilesProvider";
import { useIdentity } from "@/lib/roles/IdentityProvider";
import { ROLE_LABEL, type Profile } from "@/lib/roles/types";
import { overridesEffectifs } from "@/lib/roles/permissions";
import { ProfilEditor } from "@/components/equipe/ProfilEditor";

const ENTITE_LABEL: Record<string, string> = {
  FR: "France",
  MA: "Maroc",
  ALL: "France + Maroc",
};

function LigneProfil({
  profil,
  moi,
  onEditer,
}: {
  profil: Profile;
  moi: boolean;
  onEditer: () => void;
}) {
  const derogations = overridesEffectifs(profil.role, profil.overrides);

  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-muted">
          <UserRound className="size-[18px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">
              {profil.nom}
            </span>
            {moi ? <Badge tone="gold">vous</Badge> : null}
            {profil.demo ? <Badge tone="muted">compte de test</Badge> : null}
            {!profil.actif ? <Badge tone="alert">désactivé</Badge> : null}
          </div>
          <p className="truncate text-[12px] text-muted">{profil.email}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="text-ink">
          {profil.role ? ROLE_LABEL[profil.role] : "Non assigné"}
        </span>
        <span className="text-muted">
          {profil.entite ? ENTITE_LABEL[profil.entite] : "Aucune entité"}
        </span>
        {derogations.length > 0 ? (
          <Badge tone="gold" className="gap-1">
            <SlidersHorizontal className="size-3" strokeWidth={2} />
            personnalisé · <span className="font-mono">{derogations.length}</span>
          </Badge>
        ) : null}
      </div>

      <Button variant="secondary" size="sm" onClick={onEditer} className="sm:shrink-0">
        Modifier
      </Button>
    </div>
  );
}

export function EquipeScreen() {
  const { profiles, loaded } = useProfiles();
  const { identite } = useIdentity();
  const [editeId, setEditeId] = useState<string | null>(null);

  const edite = profiles.find((p) => p.id === editeId) ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle>Équipe</PageTitle>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">
        Le rôle décide de ce qu&apos;on fait, l&apos;entité décide de où. Les deux
        se combinent : un chargé d&apos;affaires France ne voit rien du Maroc, et
        inversement.
      </p>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-ink" strokeWidth={2} />
        <p className="text-[13px] text-gold-ink">
          Ces droits sont appliqués par l&apos;interface. Tant que la sécurité
          serveur (RLS) n&apos;est pas posée, ne créez pas de compte salarié avec
          de vraies données.
        </p>
      </div>

      <Card className="mt-5 p-0">
        {!loaded ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Chargement…</p>
        ) : (
          profiles.map((p) => (
            <LigneProfil
              key={p.id}
              profil={p}
              moi={identite.id === p.id}
              onEditer={() => setEditeId(p.id)}
            />
          ))
        )}
      </Card>

      {edite ? (
        <ProfilEditor profil={edite} onClose={() => setEditeId(null)} />
      ) : null}
    </div>
  );
}
