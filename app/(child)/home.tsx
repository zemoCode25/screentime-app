import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/features/auth/hooks/use-auth";

const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
};

export default function ChildHomeScreen() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="time" size={22} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.title}>Your Dashboard</Text>
              <Text style={styles.subtitle}>
                Hi {profile?.display_name ?? "there"}.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutPressed,
            ]}
          >
            <Ionicons name="log-out-outline" size={16} color={COLORS.text} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Today at a glance</Text>
          <Text style={styles.heroSubtitle}>
            Your focus time, breaks, and top apps in one place.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroLabel}>Focus streak</Text>
              <Text style={styles.heroValue}>2 hrs</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroLabel}>Breaks</Text>
              <Text style={styles.heroValue}>3</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <Text style={styles.sectionSubtitle}>Average across 7 days</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Daily avg</Text>
            <Text style={styles.statValue}>3h 15m</Text>
            <Text style={styles.statHint}>Target: 2h</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Most used</Text>
            <Text style={styles.statValue}>YouTube</Text>
            <Text style={styles.statHint}>1h 10m</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Apps</Text>
          <Text style={styles.sectionSubtitle}>Last 7 days</Text>
        </View>

        {["YouTube", "Roblox", "Chrome"].map((app) => (
          <View key={app} style={styles.appRow}>
            <View style={styles.appIcon}>
              <Ionicons name="apps" size={16} color={COLORS.primary} />
            </View>
            <View style={styles.appMeta}>
              <Text style={styles.appName}>{app}</Text>
              <Text style={styles.appDetail}>1h 10m - 35 opens</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGlowTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E0F2FE",
    top: -120,
    right: -80,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#EFF6FF",
    bottom: -140,
    left: -120,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signOutPressed: {
    backgroundColor: "#EEF2FF",
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  heroStats: {
    flexDirection: "row",
    gap: 12,
  },
  heroStat: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5FF",
  },
  heroLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  heroValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  statHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  appMeta: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appDetail: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
});
