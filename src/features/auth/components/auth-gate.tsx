import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useSegments } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/src/features/auth/hooks/use-auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const group = segments[0];
    if (!group) {
      return;
    }
    const isAuthGroup = group === "(auth)";
    const isParentGroup = group === "(parent)";
    const isChildGroup = group === "(child)";

    if (!session) {
      if (!isAuthGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (!profile) {
      if (!isAuthGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (profile.role === "parent" && !isParentGroup) {
      router.replace("/(parent)/home");
      return;
    }

    if (profile.role === "child" && !isChildGroup) {
      router.replace("/(child)/home");
    }
  }, [isLoading, profile, router, segments, session]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loader}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loaderText}>Restoring session...</ThemedText>
      </ThemedView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
  },
});
