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
              <Text style={styles.title}>Parent Dashboard</Text>
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
                <View style={styles.childHeaderRow}>
                  <View style={styles.childAvatar}>
                    <Text style={styles.childAvatarText}>
                      {child.name.substring(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childMeta}>
                      {child.age} years old
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

                <View style={styles.divider} />

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Avg Screen Time</Text>
                    <Text style={styles.statValue}>
                      {formatDuration(child.avgDailySeconds)}
                    </Text>
                  </View>
                  <View style={styles.verticalDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Active Days</Text>
                    <Text style={styles.statValue}>
                      {child.activeDays} days
                    </Text>
                  </View>
                </View>

                {child.interests.length > 0 && (
                  <View style={styles.tagRow}>
                    {child.interests.slice(0, 3).map((interest) => (
                      <View key={interest} style={styles.tag}>
                        <Text style={styles.tagText}>{interest}</Text>
                      </View>
                    ))}
                    {child.interests.length > 3 && (
                      <View style={styles.moreTag}>
                        <Text style={styles.moreTagText}>
                          +{child.interests.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
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
    paddingBottom: 100,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    zIndex: 10,
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

  // Refined Child Card Styles
  childCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  childCardPressed: {
    transform: [{ scale: 0.99 }],
    shadowOpacity: 0.04,
  },
  childHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  childAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  childMeta: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 4,
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  tagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  moreTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  moreTagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
});
