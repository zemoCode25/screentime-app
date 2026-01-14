import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type SignInResult = {
  error: string | null;
};

type SignUpResult = {
  error: string | null;
  needsConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: ProfileRow | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncSession = useCallback(async (nextSession: Session | null) => {
    setIsLoading(true);
    setSession(nextSession);

    if (!nextSession?.user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setProfile(data ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      await syncSession(data.session ?? null);
    };

    initialize();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }
      void syncSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [syncSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message, needsConfirmation: false };
    }

    const needsConfirmation = !data.session;

    if (data.session?.user) {
      const normalizedName = displayName.trim();
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: data.session.user.id,
          role: "parent",
          display_name: normalizedName.length > 0 ? normalizedName : null,
        })
        .select("*")
        .single();

      if (profileError) {
        return { error: profileError.message, needsConfirmation };
      }

      setProfile(profileRow);
    }

    return { error: null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, isLoading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
