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
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthValue {
  /** Auth active uniquement quand Supabase est configuré. */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /**
   * Envoie un email de réinitialisation (lien vers /reset-password). L'appelant
   * affiche un message NEUTRE quel que soit le résultat — anti-énumération.
   */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Change le mot de passe (session de récupération OU utilisateur connecté). */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback<AuthValue["signIn"]>(async (email, password) => {
    const sb = getSupabase();
    if (!sb) return { error: "Supabase non configuré." };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback<AuthValue["signOut"]>(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const resetPassword = useCallback<AuthValue["resetPassword"]>(async (email) => {
    const sb = getSupabase();
    if (!sb) return { error: "Auth non configurée." };
    // Le lien du mail renvoie ici ; l'URL doit être autorisée côté Supabase.
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error ? error.message : null };
  }, []);

  const updatePassword = useCallback<AuthValue["updatePassword"]>(async (password) => {
    const sb = getSupabase();
    if (!sb) return { error: "Auth non configurée." };
    const { error } = await sb.auth.updateUser({ password });
    return { error: error ? error.message : null };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      enabled: isSupabaseConfigured,
      loading,
      user: session?.user ?? null,
      session,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [loading, session, signIn, signOut, resetPassword, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
