import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
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

type OAuthResult = {
  error: string | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: ProfileRow | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<OAuthResult>;
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

    if (!data) {
      const metadata = nextSession.user.user_metadata ?? {};
      const displayName =
        metadata.full_name ??
        metadata.name ??
        metadata.display_name ??
        null;
      const normalizedDisplayName =
        typeof displayName === "string" && displayName.trim().length > 0
          ? displayName.trim()
          : null;

      const { data: profileRow, error: insertError } = await supabase
        .from("profiles")
        .insert({
          user_id: nextSession.user.id,
          role: "parent",
          display_name: normalizedDisplayName,
        })
        .select("*")
        .single();

      if (insertError) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setProfile(profileRow);
      setIsLoading(false);
      return;
    }

    setProfile(data);
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
    const normalizedName = displayName.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      ...(normalizedName.length > 0
        ? { options: { data: { full_name: normalizedName } } }
        : {}),
    });

    if (error) {
      return { error: error.message, needsConfirmation: false };
    }

    const needsConfirmation = !data.session;

    if (data.session?.user) {
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

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL("/(auth)/login");
    const oauthOptions =
      Platform.OS === "web"
        ? { redirectTo }
        : { redirectTo, skipBrowserRedirect: true };

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: oauthOptions,
    });

    if (error) {
      return { error: error.message };
    }

    if (Platform.OS === "web") {
      return { error: null };
    }

    if (!data?.url) {
      return { error: "Unable to start Google sign-in." };
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type !== "success" || !result.url) {
      return { error: null };
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      result.url
    );
    if (exchangeError) {
      return { error: exchangeError.message };
    }

    return { error: null };
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
      signInWithGoogle,
      signOut,
    }),
    [session, profile, isLoading, signIn, signUp, signInWithGoogle, signOut]
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
