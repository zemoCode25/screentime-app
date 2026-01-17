import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "No data" },
  { key: "mostActive", label: "Most active" },
  { key: "mostScreen", label: "Most screen time" },
  { key: "az", label: "A-Z" },
] as const;

type ChildFilterKey = (typeof FILTER_OPTIONS)[number]["key"];

export default function ParentHomeScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { data: children, isLoading, error } = useChildrenList();
  const [filter, setFilter] = useState<ChildFilterKey>("all");

  // Note: Simplified header interaction to match Child screen for consistency,
  // but we can bring back the menu if needed. For now, direct sign out button is cleaner.

  const handleSignOut = () => {
    void signOut();
  };

  const childCount = children?.length ?? 0;
  const filteredChildren = useMemo(() => {
    const list = children ?? [];

    switch (filter) {
      case "active":
        return list.filter((child) => child.activeDays > 0);
      case "inactive":
        return list.filter((child) => child.activeDays === 0);
      case "mostActive":
        return [...list].sort((a, b) => b.activeDays - a.activeDays);
      case "mostScreen":
        return [...list].sort(
          (a, b) => b.avgDailySeconds - a.avgDailySeconds
        );
      case "az":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case "all":
      default:
        return list;
    }
  }, [children, filter]);
  const visibleCount = filter === "all" ? childCount : filteredChildren.length;

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
              <Ionicons name="people" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.title}>Parent Dashboard</Text>
              <Text style={styles.subtitle}>
                Welcome back, {profile?.display_name?.split(" ")[0] ?? "Parent"}
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
            <Ionicons name="log-out-outline" size={18} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.sectionHeaderLine}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Your Children</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{visibleCount}</Text>
            </View>
          </View>
          <Link href="/(parent)/child/register" asChild>
            <Pressable style={styles.addButton}>
              <Ionicons name="add" size={16} color={COLORS.surface} />
              <Text style={styles.addButtonText}>Add Child</Text>
            </Pressable>
          </Link>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={({ pressed }) => [
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                  pressed && styles.filterButtonPressed,
                ]}
              >
                <Text
                  style={
                    isActive
                      ? styles.filterButtonTextActive
                      : styles.filterButtonText
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading family data...</Text>
          </View>
        ) : null}

        {!isLoading && childCount === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="happy-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No children yet</Text>
            <Text style={styles.emptyText}>
              Add a child profile to start monitoring their screen time and app
              usage.
            </Text>
          </View>
        ) : null}

        {!isLoading && childCount > 0 && filteredChildren.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="filter-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>
              Try a different filter to see other children.
            </Text>
          </View>
        ) : null}

        <View style={styles.childrenList}>
          {!isLoading &&
            filteredChildren.map((child) => (
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
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.childAvatar}>
                    <Text style={styles.childInitials}>
                      {child.name.substring(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childMeta}>
                      {child.age} years • {child.grade_level ?? "N/A"}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Avg Screen Time</Text>
                    <View style={styles.statValueRow}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={COLORS.primary}
                      />
                      <Text style={styles.statValue}>
                        {formatDuration(child.avgDailySeconds)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.verticalDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Active Days</Text>
                    <View style={styles.statValueRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={COLORS.success}
                      />
                      <Text style={styles.statValue}>
                        {child.activeDays} days
                      </Text>
                    </View>
                  </View>
                </View>

                {child.interests && child.interests.length > 0 && (
                  <View style={styles.tagsRow}>
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
            ))}
        </View>
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
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E0F2FE", // Blue-100
    top: -100,
    right: -100,
    opacity: 0.6,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#F0F9FF", // Sky-50
    bottom: -50,
    left: -100,
    opacity: 0.6,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signOutPressed: {
    backgroundColor: COLORS.primaryLight,
  },
  sectionHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterButtonPressed: {
    opacity: 0.9,
  },
  filterButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  filterButtonTextActive: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontFamily: "Inter_700Bold",
  },
  sectionTitleRow: {
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
  countBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    maxWidth: 240,
  },
  childrenList: {
    gap: 16,
  },
  childCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    gap: 16,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  childInitials: {
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
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  verticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  moreTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moreTagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
});
