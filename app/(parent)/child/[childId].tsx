import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import {
  useChildApps,
  useChildAppUsageDetails,
  useChildDetails,
  useChildUsageSummary,
} from "@/src/features/parent/hooks/use-child-details";
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
  error: "#DC2626",
  errorLight: "#FEF2F2",
};

const formatLabel = (value: string) => {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function ParentChildScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams();
  const resolvedChildId = Array.isArray(childId) ? childId[0] : childId;
  const [visibleAppCount, setVisibleAppCount] = useState(15);

  const childQuery = useChildDetails(resolvedChildId);
  const usageQuery = useChildUsageSummary(resolvedChildId);
  const appsQuery = useChildApps(resolvedChildId);
  const appUsageQuery = useChildAppUsageDetails(resolvedChildId);

  const isLoading =
    childQuery.isLoading ||
    usageQuery.isLoading ||
    appsQuery.isLoading ||
    appUsageQuery.isLoading;
  const error =
    childQuery.error ||
    usageQuery.error ||
    appsQuery.error ||
    appUsageQuery.error ||
    null;

  const child = childQuery.data;
  const usage = usageQuery.data;
  const apps = appsQuery.data ?? [];
  const appUsageDetails = appUsageQuery.data ?? [];

  // Create a map of usage by package name
  const usageByPackage = useMemo(() => {
    const map = new Map<string, { totalSeconds: number; openCount: number }>();
    for (const detail of appUsageDetails) {
      map.set(detail.packageName, {
        totalSeconds: detail.totalSeconds,
        openCount: detail.openCount,
      });
    }
    return map;
  }, [appUsageDetails]);

  // Combine apps with usage data and sort by usage
  const sortedApps = useMemo(() => {
    return apps
      .map((app) => {
        const usage = usageByPackage.get(app.package_name);
        return {
          ...app,
          totalSeconds: usage?.totalSeconds ?? 0,
          openCount: usage?.openCount ?? 0,
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [apps, usageByPackage]);

  const visibleApps = sortedApps.slice(0, visibleAppCount);
  const hasMoreApps = sortedApps.length > visibleAppCount;

  const appNameMap = new Map(
    apps.map((app) => [app.package_name, app.app_name])
  );

  const mostUsedApp = usage?.mostUsedPackage
    ? appNameMap.get(usage.mostUsedPackage) ?? usage.mostUsedPackage
    : "No data yet";

  const handleLoadMore = () => {
    setVisibleAppCount((prev) => prev + 15);
  };

  if (!resolvedChildId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Child not found</Text>
        <Pressable
          onPress={() => router.replace("/(parent)/home")}
          style={styles.backHome}
        >
          <Text style={styles.backHomeText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.backgroundGlow} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Child Overview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : null}

        {child ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {child.name.substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childMeta}>
                  {child.age} Years Old • {child.grade_level || "No Grade"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.tagsContainer}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <View style={styles.tagRow}>
                {child.interests.map((interest) => (
                  <View key={interest} style={styles.tag}>
                    <Text style={styles.tagText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.tagsContainer}>
              <Text style={styles.sectionLabel}>Goals</Text>
              <View style={styles.tagRow}>
                {child.motivations.map((motivation) => (
                  <View key={motivation} style={styles.tagSecondary}>
                    <Text style={styles.tagSecondaryText}>
                      {formatLabel(motivation)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitleLarge}>Activity Summary</Text>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Daily Avg</Text>
              <Text style={styles.metricValue}>
                {formatDuration(usage?.avgDailySeconds ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconBox, { backgroundColor: "#DCFCE7" }]}
            >
              <Ionicons name="calendar-outline" size={18} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.metricLabel}>Active Days</Text>
              <Text style={styles.metricValue}>
                {usage?.activeDays ?? 0} days
              </Text>
            </View>
          </View>

          <View style={styles.metricCardWide}>
            <View
              style={[styles.metricIconBox, { backgroundColor: "#FEF3C7" }]}
            >
              <Ionicons name="star-outline" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>Most Used App</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {mostUsedApp}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.appsSection}>
          <View style={styles.appsHeader}>
            <Text style={styles.sectionTitleLarge}>Installed Apps</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{sortedApps.length}</Text>
            </View>
          </View>
          {sortedApps.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="apps-outline"
                size={32}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyTitle}>No apps detected</Text>
              <Text style={styles.emptyText}>
                App usage data will appear here once the child device syncs.
              </Text>
            </View>
          ) : (
            <>
              {visibleApps.map((app, index) => (
                <View key={app.id} style={styles.appRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.appIcon}>
                    <Ionicons
                      name="cube-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{app.app_name}</Text>
                    <Text style={styles.appMeta}>
                      {formatLabel(app.category)} •{" "}
                      {formatDuration(app.totalSeconds)}
                    </Text>
                    {app.openCount > 0 ? (
                      <Text style={styles.appUsageDetail}>
                        {app.openCount} opens in last 30 days
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.appStatus}>
                    <Ionicons
                      name={
                        app.totalSeconds > 0
                          ? "trending-up"
                          : "checkmark-circle"
                      }
                      size={16}
                      color={app.totalSeconds > 0 ? COLORS.primary : "#16A34A"}
                    />
                  </View>
                </View>
              ))}
              {hasMoreApps ? (
                <Pressable
                  onPress={handleLoadMore}
                  style={({ pressed }) => [
                    styles.loadMoreButton,
                    pressed && styles.loadMoreButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.loadMoreText}>
                    Load more ({sortedApps.length - visibleAppCount} remaining)
                  </Text>
                </Pressable>
              ) : sortedApps.length > 15 ? (
                <View style={styles.allLoadedCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#16A34A"
                  />
                  <Text style={styles.allLoadedText}>
                    All {sortedApps.length} apps loaded
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#E0F2FE", // Subtle blue glow
    top: -140,
    right: -120,
    opacity: 0.8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
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
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  profileCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  childName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  childMeta: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
  },
  tagsContainer: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  tagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: "Inter_500Medium",
  },
  tagSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tagSecondaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  sectionTitleLarge: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricCardWide: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  metricValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  appsSection: {
    gap: 16,
  },
  appsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 14,
    maxWidth: 240,
    fontFamily: "Inter_400Regular",
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  appUsageDetail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  appStatus: {
    opacity: 0.8,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginTop: 8,
  },
  loadMoreButtonPressed: {
    opacity: 0.7,
  },
  loadMoreText: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  allLoadedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  allLoadedText: {
    fontSize: 13,
    color: "#16A34A",
    fontFamily: "Inter_500Medium",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: COLORS.background,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  backHome: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  backHomeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
