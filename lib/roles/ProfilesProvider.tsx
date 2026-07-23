"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";
import type {
  AccessAction,
  AccessLogEntry,
  EntiteAcces,
  Profile,
  Role,
} from "@/lib/roles/types";
import { ROLE_LABEL } from "@/lib/roles/types";
import { getProfilesRepository, profilesRepoKind } from "@/lib/roles/repository";
import { overridesEffectifs } from "@/lib/roles/permissions";
import { uid } from "@/lib/uid";

const JOURNAL_KEY = "vde.roles.journal.v1";

/** Entrée créée depuis l'écran Équipe (« Inviter un membre »). */
export interface NouveauMembre {
  nom: string;
  email: string;
  telephone?: string | null;
  role: Role | null;
  entite: EntiteAcces | null;
}

interface ProfilesValue {
  loaded: boolean;
  profiles: Profile[];
  journal: AccessLogEntry[];
  /** Crée un membre (deny par défaut si rôle/entité non fixés). */
  addProfile: (input: NouveauMembre, auteur: string) => Profile;
  /** Renvoie l'invitation (réhorodate) d'un membre pas encore connecté. */
  renvoyerInvitation: (id: string, auteur: string) => void;
  /** Modifie un profil et journalise chaque changement de droits. */
  updateProfile: (id: string, patch: Partial<Profile>, auteur: string) => void;
  /** Désactive / réactive (l'historique est conservé — ce n'est PAS une suppression). */
  setActifProfile: (id: string, actif: boolean, auteur: string) => void;
  /** Suppression DURE — réservée aux comptes de démonstration. */
  deleteProfile: (id: string, auteur: string) => void;
  /** Purge tous les comptes de test d'un coup (nettoyage avant prod). */
  purgeDemoProfiles: (auteur: string) => number;
  profilById: (id: string | null) => Profile | null;
  /** Vrai si `id` est le dernier administrateur actif (non touchable). */
  estDernierAdminActif: (id: string) => boolean;
}

const ProfilesContext = createContext<ProfilesValue | null>(null);

const ENTITE_LABEL: Record<string, string> = {
  FR: "France",
  MA: "Maroc",
  ALL: "France + Maroc",
};
const roleLabel = (r: Role | null) => (r ? ROLE_LABEL[r] : "Non assigné");
const entiteLabel = (e: EntiteAcces | null) => (e ? ENTITE_LABEL[e] : "Aucune entité");

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const persistErr = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [journal, setJournal] = useState<AccessLogEntry[]>([]);

  useEffect(() => {
    let actif = true;
    getProfilesRepository()
      .loadAll()
      .then((p) => {
        if (!actif) return;
        setProfiles(p);
        setLoaded(true);
      })
      .catch(() => actif && setLoaded(true));
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) setJournal(JSON.parse(raw) as AccessLogEntry[]);
    } catch {
      /* ignore */
    }
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void getProfilesRepository()
      .persistAll(profiles)
      .then((res) => {
        if (res.error) {
          if (persistErr.current !== res.error) {
            persistErr.current = res.error;
            console.error("[persist] profiles:", res.error);
            notify(`Sauvegarde impossible (${res.error}). Recharge la page.`, "alert");
          }
        } else {
          persistErr.current = null;
        }
      });
  }, [loaded, profiles, notify]);

  const log = useCallback(
    (auteur: string, action: AccessAction, cible: string, detail: string) => {
      setJournal((prev) => {
        const next = [
          { id: uid(), at: new Date().toISOString(), auteur, action, cible, detail },
          ...prev,
        ].slice(0, 500); // journal borné — right-sized, pas un SIEM
        try {
          localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const profilById = useCallback<ProfilesValue["profilById"]>(
    (id) => (id ? (profiles.find((p) => p.id === id) ?? null) : null),
    [profiles],
  );

  const estDernierAdminActif = useCallback<ProfilesValue["estDernierAdminActif"]>(
    (id) => {
      const admins = profiles.filter((p) => p.role === "admin" && p.actif);
      return admins.length === 1 && admins[0].id === id;
    },
    [profiles],
  );

  const addProfile = useCallback<ProfilesValue["addProfile"]>(
    (input, auteur) => {
      // `ALL` reste réservé à l'admin ; tout autre rôle avec ALL → non assigné.
      const entite =
        input.entite === "ALL" && input.role !== "admin" ? null : input.entite;
      const now = new Date().toISOString();
      const profil: Profile = {
        id: uid(),
        email: input.email.trim(),
        nom: input.nom.trim(),
        telephone: input.telephone?.trim() || null,
        role: input.role,
        entite,
        actif: true,
        overrides: {},
        demo: false,
        invite_le: now, // invité → « en attente » tant que non connecté
        derniere_connexion: null,
        modifie_par: auteur,
        modifie_le: now,
        created_at: now,
      };
      setProfiles((prev) => [...prev, profil]);
      log(
        auteur,
        "creation",
        profil.nom || profil.email,
        `invité — ${roleLabel(profil.role)} · ${entiteLabel(profil.entite)}${
          !profil.role || !profil.entite ? " (non assigné : aucun accès)" : ""
        }`,
      );
      return profil;
    },
    [log],
  );

  const renvoyerInvitation = useCallback<ProfilesValue["renvoyerInvitation"]>(
    (id, auteur) => {
      const p = profiles.find((x) => x.id === id);
      if (!p) return;
      setProfiles((prev) =>
        prev.map((x) => (x.id === id ? { ...x, invite_le: new Date().toISOString() } : x)),
      );
      log(auteur, "creation", p.nom || p.email, "invitation renvoyée");
    },
    [profiles, log],
  );

  const updateProfile = useCallback<ProfilesValue["updateProfile"]>(
    (id, patch, auteur) => {
      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const cible = p.nom || p.email;
          // Journalise chaque dimension réellement modifiée.
          if (patch.role !== undefined && patch.role !== p.role) {
            log(auteur, "role", cible, `rôle : ${roleLabel(p.role)} → ${roleLabel(patch.role)}`);
          }
          if (patch.entite !== undefined && patch.entite !== p.entite) {
            log(auteur, "entite", cible, `entité : ${entiteLabel(p.entite)} → ${entiteLabel(patch.entite)}`);
          }
          if (patch.actif !== undefined && patch.actif !== p.actif) {
            log(auteur, "activation", cible, patch.actif ? "réactivé" : "désactivé — accès coupé");
          }
          if (patch.overrides !== undefined) {
            const avant = overridesEffectifs(patch.role ?? p.role, p.overrides).length;
            const apres = overridesEffectifs(patch.role ?? p.role, patch.overrides).length;
            if (apres !== avant) {
              log(auteur, "override", cible, `dérogations : ${avant} → ${apres}`);
            }
          }
          return {
            ...p,
            ...patch,
            modifie_par: auteur,
            modifie_le: new Date().toISOString(),
          };
        }),
      );
    },
    [log],
  );

  const setActifProfile = useCallback<ProfilesValue["setActifProfile"]>(
    (id, actif, auteur) => {
      // Verrou anti-impasse : on ne coupe jamais le dernier admin actif.
      if (!actif && estDernierAdminActif(id)) return;
      updateProfile(id, { actif }, auteur);
    },
    [estDernierAdminActif, updateProfile],
  );

  const deleteProfile = useCallback<ProfilesValue["deleteProfile"]>(
    (id, auteur) => {
      const p = profiles.find((x) => x.id === id);
      // Suppression DURE réservée aux comptes de test — un vrai membre se
      // désactive (historique conservé).
      if (!p || !p.demo) return;
      setProfiles((prev) => prev.filter((x) => x.id !== id));
      log(auteur, "suppression", p.nom || p.email, "compte de test supprimé");
    },
    [profiles, log],
  );

  const purgeDemoProfiles = useCallback<ProfilesValue["purgeDemoProfiles"]>(
    (auteur) => {
      const demos = profiles.filter((p) => p.demo);
      if (demos.length === 0) return 0;
      setProfiles((prev) => prev.filter((p) => !p.demo));
      log(auteur, "suppression", `${demos.length} comptes de test`, "purge avant mise en production");
      return demos.length;
    },
    [profiles, log],
  );

  const value = useMemo<ProfilesValue>(
    () => ({
      loaded,
      profiles,
      journal,
      addProfile,
      renvoyerInvitation,
      updateProfile,
      setActifProfile,
      deleteProfile,
      purgeDemoProfiles,
      profilById,
      estDernierAdminActif,
    }),
    [
      loaded,
      profiles,
      journal,
      addProfile,
      renvoyerInvitation,
      updateProfile,
      setActifProfile,
      deleteProfile,
      purgeDemoProfiles,
      profilById,
      estDernierAdminActif,
    ],
  );

  return (
    <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
  );
}

export function useProfiles(): ProfilesValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error("useProfiles doit être utilisé dans <ProfilesProvider>");
  return ctx;
}

export { profilesRepoKind };
