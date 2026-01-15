import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
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
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<OAuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SessionUser = Session["user"];

const parseParams = (value: string) => {
  if (!value) {
    return {};
  }
  return value.split("&").reduce<Record<string, string>>((acc, pair) => {
    if (!pair) {
      return acc;
    }
    const [key, raw] = pair.split("=");
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(raw ?? "");
    return acc;
  }, {});
};

const getParamsFromUrl = (url: string) => {
  const [baseAndQuery, hash = ""] = url.split("#");
  const query = baseAndQuery.split("?")[1] ?? "";
  return { ...parseParams(query), ...parseParams(hash) };
};

const getDisplayName = (user: SessionUser) => {
  const metadata = user.user_metadata ?? {};
  const displayName =
    metadata.full_name ?? metadata.name ?? metadata.display_name ?? null;
  return typeof displayName === "string" && displayName.trim().length > 0
    ? displayName.trim()
    : null;
};

const getNormalizedEmail = (user: SessionUser) =>
  typeof user.email === "string" && user.email.trim().length > 0
    ? user.email.trim().toLowerCase()
    : null;

const createFallbackProfile = (
  user: SessionUser,
  role: ProfileRow["role"]
): ProfileRow => ({
  user_id: user.id,
  role,
  display_name: getDisplayName(user),
  created_at: new Date().toISOString(),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncSession = useCallback(async (nextSession: Session | null) => {
    setIsLoading(true);
    setSession(nextSession);

    const finalize = (nextProfile: ProfileRow | null) => {
      setProfile(nextProfile);
      setIsLoading(false);
    };

    if (!nextSession?.user) {
      finalize(null);
      return;
    }

    const normalizedDisplayName = getDisplayName(nextSession.user);
    const normalizedEmail = getNormalizedEmail(nextSession.user);

    const logChildMatch = (source: string) => {
      console.warn("Auth sync: matched child", source);
    };

    const claimChild = async () => {
      if (normalizedEmail) {
        const { data: claimedChild, error: claimError } = await supabase
          .from("children")
          .update({ child_user_id: nextSession.user.id })
          .is("child_user_id", null)
          .eq("child_email", normalizedEmail)
          .select("id,child_user_id,child_email")
          .maybeSingle();

        if (claimError) {
          console.warn("Auth sync: failed to claim child.", claimError);
        }
        if (claimedChild) {
          logChildMatch("claimed");
          return claimedChild;
        }
      }

      const { data: existingChild, error: existingError } = await supabase
        .from("children")
        .select("id,child_user_id,child_email")
        .eq("child_user_id", nextSession.user.id)
        .maybeSingle();

      if (existingError) {
        console.warn("Auth sync: failed to load child link.", existingError);
      }
      if (existingChild) {
        logChildMatch("linked");
        return existingChild;
      }

      if (normalizedEmail) {
        const { data: emailChild, error: emailError } = await supabase
          .from("children")
          .select("id,child_user_id,child_email")
          .eq("child_email", normalizedEmail)
          .maybeSingle();

        if (emailError) {
          console.warn("Auth sync: failed to match child email.", emailError);
        }

        if (emailChild) {
          logChildMatch("email");
        }
        return emailChild ?? null;
      }

      return null;
    };

    const loadProfile = async () =>
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();

    const { data, error } = await loadProfile();

    if (error) {
      console.warn("Auth sync: failed to load profile.", error);
      const childMatch = await claimChild();
      const fallbackProfile = createFallbackProfile(
        nextSession.user,
        childMatch ? "child" : "parent"
      );
      finalize(fallbackProfile);
      return;
    }

    if (data) {
      if (data.role !== "child") {
        const childMatch = await claimChild();
        if (childMatch) {
          const { data: updatedProfile, error: updateError } = await supabase
            .from("profiles")
            .update({ role: "child" })
            .eq("user_id", nextSession.user.id)
            .select("*")
            .single();

          if (updateError) {
            console.warn(
              "Auth sync: failed to update profile role.",
              updateError
            );
            finalize({ ...data, role: "child" });
            return;
          }

          finalize(updatedProfile ?? { ...data, role: "child" });
          return;
        }
      }

      finalize(data);
      return;
    }

    if (!data) {
      const childMatch = await claimChild();
      const role: ProfileRow["role"] = childMatch ? "child" : "parent";
      const fallbackProfile = createFallbackProfile(nextSession.user, role);

      const { data: profileRow, error: insertError } = await supabase
        .from("profiles")
        .insert({
          user_id: nextSession.user.id,
          role,
          display_name: normalizedDisplayName,
        })
        .select("*")
        .single();

      if (insertError) {
        console.warn("Auth sync: failed to insert profile.", insertError);
        if (insertError.code === "23505") {
          const { data: retryData, error: retryError } = await loadProfile();
          if (retryError) {
            console.warn("Auth sync: failed to reload profile.", retryError);
          }
          if (retryData) {
            finalize(retryData);
            return;
          }

          finalize(fallbackProfile);
          return;
        }
        if (insertError.code === "23503") {
          await supabase.auth.signOut();
          setSession(null);
          finalize(null);
          return;
        }
        finalize(null);
        return;
      }

      if (!profileRow) {
        finalize(fallbackProfile);
        return;
      }

      finalize(profileRow);
      return;
    }
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

  useEffect(() => {
    let isMounted = true;

    const exchangeFromUrl = async (url: string) => {
      if (!url) {
        return;
      }
      const params = getParamsFromUrl(url);
      if (params.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.warn("Auth sync: failed to exchange oauth url.", error);
          return;
        }
        if (!isMounted) {
          return;
        }
        await syncSession(data.session ?? null);
        return;
      }
      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) {
          console.warn("Auth sync: failed to set oauth session.", error);
          return;
        }
        if (!isMounted) {
          return;
        }
        await syncSession(data.session ?? null);
      }
    };

    const bootstrap = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!isMounted) {
        return;
      }
      if (initialUrl) {
        await exchangeFromUrl(initialUrl);
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void exchangeFromUrl(url);
    });

    void bootstrap();

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [syncSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        await syncSession(data.session);
      }

      return { error: null };
    },
    [syncSession]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
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
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    const redirectPath = Platform.OS === "web" ? "/(auth)/login" : "/";
    const redirectTo =
      Platform.OS === "web"
        ? Linking.createURL(redirectPath)
        : Linking.createURL(redirectPath, { scheme: "screentimeapp" });
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

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== "success" || !result.url) {
      return { error: null };
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      result.url
    );
    if (exchangeError) {
      return { error: exchangeError.message };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    await syncSession(sessionData.session ?? null);

    return { error: null };
  }, [syncSession]);

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

