import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/src/features/auth/hooks/use-auth";

export default function ChildHomeScreen() {
  const { profile, signOut } = useAuth();
  const handleSignOut = () => {
    void signOut();
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Child Home</ThemedText>
        <ThemedText style={styles.subtitle}>
          Hi {profile?.display_name ?? "there"}.
        </ThemedText>
      </View>
      <Pressable onPress={handleSignOut}>
        <ThemedText type="link">Sign out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
  },
});
