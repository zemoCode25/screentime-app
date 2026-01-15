import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/features/auth/hooks/use-auth";
import { useChildrenList } from "@/src/features/parent/hooks/use-children";
import { formatDuration } from "@/src/utils/time";

const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  success: "#16A34A",
  error: "#DC2626",
  errorLight: "#FEF2F2",
};

export default function ParentHomeScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { data: children, isLoading, error } = useChildrenList();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = () => {
    void signOut();
  };

  const childCount = children?.length ?? 0;
  const initials = profile?.display_name
    ? profile.display_name.substring(0, 2).toUpperCase()
    : "P";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
              <Text style={styles.title}>Family Dashboard</Text>
              <Text style={styles.subtitle}>
                Welcome {profile?.display_name ?? "back"}
              </Text>
            </View>
          </View>

          {/* Profile Dropdown Trigger */}
          <View style={styles.profileContainer}>
            <Pressable
              onPress={() => setShowMenu(!showMenu)}
              style={styles.profileButton}
            >
              <Text style={styles.profileInitials}>{initials}</Text>
            </Pressable>

            {/* Dropdown Menu */}
            {showMenu && (
              <View style={styles.dropdownMenu}>
                <Pressable
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={16}
                    color={COLORS.error}
                  />
                  <Text style={styles.menuItemText}>Sign out</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.sectionTitle}>Children</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{childCount}</Text>
            </View>
          </View>
          <Link href="/(parent)/child/register" asChild>
            <Pressable style={styles.displayButton}>
              <Ionicons name="add" size={16} color={COLORS.surface} />
              <Text style={styles.displayButtonText}>Add Child</Text>
            </Pressable>
          </Link>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading children...</Text>
          </View>
        ) : null}

        {!isLoading && childCount === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="people-outline"
                size={32}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>No children yet</Text>
            <Text style={styles.emptyText}>
              Add your first child to start tracking usage insights.
            </Text>
          </View>
        ) : null}

        {!isLoading
          ? children?.map((child) => (
              <Pressable
                key={child.id}
                onPress={() =>
                  router.push({
                    pathname: "/(parent)/child/[childId]",
                    params: { childId: child.id },
                  })
                }
                style={({ pressed }) => [
                  styles.childCard,
                  pressed && styles.childCardPressed,
                ]}
              >
                <View style={styles.childCardHeader}>
                  <View>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childMeta}>
                      Age {child.age}
                      {child.grade_level ? ` • ${child.grade_level}` : ""}
                    </Text>
                  </View>
                  <View style={styles.chevronContainer}>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Avg 30d</Text>
                    <Text style={styles.statValue}>
                      {formatDuration(child.avgDailySeconds)}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Active days</Text>
                    <Text style={styles.statValue}>{child.activeDays}</Text>
                  </View>
                </View>

                <View style={styles.tagRow}>
                  {child.interests.slice(0, 3).map((interest) => (
                    <View key={interest} style={styles.tag}>
                      <Text style={styles.tagText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 100, // Extra padding for vertical limit/safe area
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    zIndex: 10, // Ensure dropdown is on top
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
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
  profileContainer: {
    position: "relative",
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  profileInitials: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  dropdownMenu: {
    position: "absolute",
    top: 50,
    right: 0,
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  menuItemPressed: {
    backgroundColor: COLORS.errorLight,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  displayButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  displayButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.errorLight,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 14,
    maxWidth: 240,
    fontFamily: "Inter_400Regular",
  },
  childCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  childCardPressed: {
    backgroundColor: "#F8FAFC",
    transform: [{ scale: 0.98 }],
  },
  childCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  childName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  childMeta: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
});
