"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile } from "@/lib/roles/types";
import { getProfilesRepository, profilesRepoKind } from "@/lib/roles/repository";

interface ProfilesValue {
  loaded: boolean;
  profiles: Profile[];
  /** Modifie un profil et horodate qui a touché aux droits. */
  updateProfile: (id: string, patch: Partial<Profile>, auteur: string) => void;
  profilById: (id: string | null) => Profile | null;
}

const ProfilesContext = createContext<ProfilesValue | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

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
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void getProfilesRepository().persistAll(profiles);
  }, [loaded, profiles]);

  const updateProfile = useCallback<ProfilesValue["updateProfile"]>(
    (id, patch, auteur) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...patch,
                modifie_par: auteur,
                modifie_le: new Date().toISOString(),
              }
            : p,
        ),
      );
    },
    [],
  );

  const profilById = useCallback<ProfilesValue["profilById"]>(
    (id) => (id ? (profiles.find((p) => p.id === id) ?? null) : null),
    [profiles],
  );

  const value = useMemo<ProfilesValue>(
    () => ({ loaded, profiles, updateProfile, profilById }),
    [loaded, profiles, updateProfile, profilById],
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
