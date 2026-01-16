import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  useChildApps,
  useChildLimits,
  useChildProfile,
  useChildUsageDaily,
} from "@/src/features/child/hooks/use-child-data";
import { syncChildDeviceUsage } from "@/src/features/child/services/device-usage-sync";
import { seedChildMockUsage } from "@/src/features/child/services/child-service";
import {
  APP_CATEGORY_ORDER,
  getAppCategoryLabel,
  resolveAppCategory,
  type AppCategory,
} from "@/src/utils/app-category";
import { formatDuration } from "@/src/utils/time";
import { canUseUsageStats } from "@/src/lib/usage-stats";
import type { Database } from "@/types/database-types";

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

type AppLimitRow = Database["public"]["Tables"]["app_limits"]["Row"];
type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];
type AppBase = Pick<
  ChildAppRow,
  "id" | "app_name" | "category" | "package_name" | "icon_path"
>;

type AppCard = {
  id: string;
  name: string;
  packageName: string;
  category: AppCategory;
  totalSeconds: number;
  avgDailySeconds: number;
  openCount: number;
  limitSeconds: number | null;
  remainingSeconds: number | null;
  progress: number;
};

const getIsoDate = (date: Date) => date.toISOString().slice(0, 10);
const getDateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getIsoDate(date);
};

type TimeRangeKey = "today" | "week" | "month";

const TIME_RANGE_OPTIONS: Record<
  TimeRangeKey,
  {
    label: string;
    days: number;
    title: string;
    subtitle: string;
    rangeLabel: string;
  }
> = {
  today: {
    label: "Today",
    days: 1,
    title: "Today at a glance",
    subtitle: "Your live progress",
    rangeLabel: "today",
  },
  week: {
    label: "7 days",
    days: 7,
    title: "This week at a glance",
    subtitle: "Rolling 7-day window",
    rangeLabel: "last 7 days",
  },
  month: {
    label: "30 days",
    days: 30,
    title: "This month at a glance",
    subtitle: "Rolling 30-day window",
    rangeLabel: "last 30 days",
  },
};

const isLimitActiveForDate = (limit: AppLimitRow, date: Date) => {
  switch (date.getDay()) {
    case 0:
      return limit.applies_sun;
    case 1:
      return limit.applies_mon;
    case 2:
      return limit.applies_tue;
    case 3:
      return limit.applies_wed;
    case 4:
      return limit.applies_thu;
    case 5:
      return limit.applies_fri;
    case 6:
      return limit.applies_sat;
    default:
      return true;
  }
};

const getLimitSecondsForDate = (limit: AppLimitRow, date: Date) => {
  if (!isLimitActiveForDate(limit, date)) {
    return null;
  }

  const bonusSeconds = limit.bonus_enabled ? limit.bonus_seconds : 0;
  return limit.limit_seconds + bonusSeconds;
};

export default function ChildHomeScreen() {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("today");
  const [selectedCategory, setSelectedCategory] = useState<
    AppCategory | "all"
  >("all");
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const { data: child, isLoading: childLoading, error: childError } =
    useChildProfile();
  const childId = child?.id;
  const today = useMemo(() => new Date(), []);
  const rangeConfig = TIME_RANGE_OPTIONS[timeRange];
  const rangeDays = rangeConfig.days;
  const startDate = getDateDaysAgo(rangeDays - 1);
  const isTodayRange = timeRange === "today";

  const { data: apps, isLoading: appsLoading, error: appsError } =
    useChildApps(childId);
  const { data: usageRows, isLoading: usageLoading, error: usageError } =
    useChildUsageDaily(childId, startDate);
  const { data: limits, isLoading: limitsLoading, error: limitsError } =
    useChildLimits(childId);

  const isLoading =
    childLoading || appsLoading || usageLoading || limitsLoading;
  const error = childError ?? appsError ?? usageError ?? limitsError;

  const {
    appCards,
    totalSecondsRange,
    avgDailySecondsRange,
    remainingSeconds,
    hasLimits,
    appsUsed,
    mostUsedAppName,
  } = useMemo(() => {
    const usageByPackage = new Map<
      string,
      { totalSeconds: number; openCount: number }
    >();

    for (const row of usageRows ?? []) {
      const entry = usageByPackage.get(row.package_name) ?? {
        totalSeconds: 0,
        openCount: 0,
      };
      entry.totalSeconds += row.total_seconds ?? 0;
      entry.openCount += row.open_count ?? 0;
      usageByPackage.set(row.package_name, entry);
    }

    const limitsByPackage = new Map<string, AppLimitRow>();
    for (const limit of limits ?? []) {
      limitsByPackage.set(limit.package_name, limit);
    }

    const baseApps: AppBase[] =
      apps && apps.length > 0
        ? apps
        : Array.from(usageByPackage.keys()).map((packageName) => ({
            id: packageName,
            app_name: packageName,
            category: "other",
            package_name: packageName,
            icon_path: null,
          }));

    const usageValues = baseApps.map((app) => {
      const totalSeconds =
        usageByPackage.get(app.package_name)?.totalSeconds ?? 0;
      return isTodayRange ? totalSeconds : totalSeconds / rangeDays;
    });
    const maxUsage = Math.max(...usageValues, 1);

    let totalSeconds = 0;
    let totalLimitSeconds = 0;
    let totalRemainingSeconds = 0;
    let usedAppsCount = 0;
    let topAppName = "No usage yet";
    let topAppSeconds = 0;

    const cards: AppCard[] = baseApps
      .map((app) => {
        const usage = usageByPackage.get(app.package_name) ?? {
          totalSeconds: 0,
          openCount: 0,
        };

        totalSeconds += usage.totalSeconds;
        if (usage.totalSeconds > 0) {
          usedAppsCount += 1;
        }

        if (usage.totalSeconds > topAppSeconds) {
          topAppSeconds = usage.totalSeconds;
          topAppName = app.app_name;
        }

        const limit = limitsByPackage.get(app.package_name);
        const limitSeconds = limit
          ? getLimitSecondsForDate(limit, today)
          : null;
        const avgDailySeconds = usage.totalSeconds / rangeDays;
        const remainingSeconds =
          isTodayRange && limitSeconds !== null
            ? Math.max(limitSeconds - usage.totalSeconds, 0)
            : null;

        if (isTodayRange && limitSeconds !== null) {
          totalLimitSeconds += limitSeconds;
          totalRemainingSeconds += remainingSeconds ?? 0;
        }

        const usageForProgress = isTodayRange
          ? usage.totalSeconds
          : avgDailySeconds;
        const progress = limitSeconds
          ? Math.min(usageForProgress / limitSeconds, 1)
          : usageForProgress / maxUsage;

        return {
          id: app.id,
          name: app.app_name,
          packageName: app.package_name,
          category: resolveAppCategory(app.category, app.package_name),
          totalSeconds: usage.totalSeconds,
          avgDailySeconds,
          openCount: usage.openCount,
          limitSeconds,
          remainingSeconds,
          progress,
        };
      })
      .filter((card) => {
        if (apps && apps.length > 0) {
          return true;
        }
        return card.totalSeconds > 0 || card.limitSeconds !== null;
      })
      .sort((a, b) => {
        const aActive = a.totalSeconds > 0;
        const bActive = b.totalSeconds > 0;
        if (aActive !== bActive) {
          return aActive ? -1 : 1;
        }
        if (b.totalSeconds !== a.totalSeconds) {
          return b.totalSeconds - a.totalSeconds;
        }
        return a.name.localeCompare(b.name);
      });

    return {
      appCards: cards,
      totalSecondsRange: totalSeconds,
      avgDailySecondsRange: totalSeconds / rangeDays,
      remainingSeconds: totalRemainingSeconds,
      hasLimits: isTodayRange && totalLimitSeconds > 0,
      appsUsed: usedAppsCount,
      mostUsedAppName: topAppName,
    };
  }, [apps, isTodayRange, limits, rangeDays, today, usageRows]);

  const hasAppCatalog = (apps?.length ?? 0) > 0;
  const availableCategories = useMemo(() => {
    const categorySet = new Set<AppCategory>();
    for (const card of appCards) {
      categorySet.add(card.category);
    }
    return APP_CATEGORY_ORDER.filter((category) => categorySet.has(category));
  }, [appCards]);

  const filteredAppCards =
    selectedCategory === "all"
      ? appCards
      : appCards.filter((card) => card.category === selectedCategory);

  const greetingName = child?.name ?? profile?.display_name ?? "there";

  const handleSignOut = () => {
    void signOut();
  };

  const handleMockSync = async () => {
    if (!childId || isSeeding) {
      return;
    }
    setSeedError(null);
    setIsSeeding(true);
    try {
      await seedChildMockUsage(childId);
      await queryClient.invalidateQueries({ queryKey: ["child"] });
    } catch (err) {
      setSeedError(
        err instanceof Error ? err.message : "Failed to seed mock data."
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeviceSync = async () => {
    if (!childId || isSyncing) {
      return;
    }
    setSyncError(null);
    setSyncMessage(null);
    setIsSyncing(true);
    try {
      const result = await syncChildDeviceUsage(childId, 7);
      if (result.accessStatus === "unavailable") {
        setSyncError(
          "Usage access module not available. Build a custom dev client for Android."
        );
        return;
      }
      if (result.accessStatus === "needs-permission") {
        setSyncError(
          "Enable Usage Access in Settings, then tap Sync again."
        );
        return;
      }
      setSyncMessage(
        `Synced ${result.appsSynced} apps and ${result.usageRows} usage rows.`
      );
      await queryClient.invalidateQueries({ queryKey: ["child"] });
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Failed to sync device usage."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const secondaryValue = isTodayRange
    ? hasLimits
      ? formatDuration(remainingSeconds)
      : `${appsUsed} apps`
    : formatDuration(avgDailySecondsRange);
  const secondaryLabel = isTodayRange
    ? hasLimits
      ? "Remaining"
      : "Apps used"
    : "Avg per day";
  const totalLabel = isTodayRange
    ? "Used today"
    : `Total ${rangeConfig.rangeLabel}`;
  const totalHint = isTodayRange
    ? "Total screen time"
    : `Total in ${rangeConfig.rangeLabel}`;
  const mostUsedHint = isTodayRange
    ? "Top app today"
    : `Top app in ${rangeConfig.rangeLabel}`;
  const appsSectionTitle = "Apps on your device";
  const rangeKeys: TimeRangeKey[] = ["today", "week", "month"];
  const showNoApps =
    !hasAppCatalog && appCards.length === 0 && !isLoading;
  const canSyncDevice = Boolean(childId) && canUseUsageStats();

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
              <Ionicons name="time" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.subtitle}>Hi, {greetingName}!</Text>
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

        <View style={styles.syncCard}>
          <View style={styles.syncRow}>
            <View>
              <Text style={styles.syncTitle}>Device sync</Text>
              <Text style={styles.syncText}>
                Pull installed apps and screen time from this device.
              </Text>
            </View>
            <Pressable
              onPress={handleDeviceSync}
              disabled={isSyncing || !canSyncDevice}
              style={({ pressed }) => [
                styles.syncButton,
                (!canSyncDevice || isSyncing) && styles.syncButtonDisabled,
                pressed && styles.syncButtonPressed,
              ]}
            >
              {isSyncing ? (
                <ActivityIndicator color={COLORS.surface} size="small" />
              ) : (
                <Text style={styles.syncButtonText}>Sync now</Text>
              )}
            </Pressable>
          </View>
          {!canSyncDevice ? (
            <Text style={styles.syncHint}>
              Android custom dev client required.
            </Text>
          ) : null}
          {syncMessage ? (
            <Text style={styles.syncSuccess}>{syncMessage}</Text>
          ) : null}
          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
        </View>

        {__DEV__ ? (
          <View style={styles.mockCard}>
            <View style={styles.mockRow}>
              <View>
                <Text style={styles.mockTitle}>Mock sync</Text>
                <Text style={styles.mockText}>
                  Seed sample apps and usage for this child account.
                </Text>
              </View>
              <Pressable
                onPress={handleMockSync}
                disabled={isSeeding || !childId}
                style={({ pressed }) => [
                  styles.mockButton,
                  (isSeeding || !childId) && styles.mockButtonDisabled,
                  pressed && styles.mockButtonPressed,
                ]}
              >
                {isSeeding ? (
                  <ActivityIndicator color={COLORS.surface} size="small" />
                ) : (
                  <Text style={styles.mockButtonText}>Seed data</Text>
                )}
              </Pressable>
            </View>
            {seedError ? (
              <Text style={styles.mockError}>{seedError}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.rangeRow}>
          {rangeKeys.map((rangeKey) => {
            const isActive = rangeKey === timeRange;
            return (
              <Pressable
                key={rangeKey}
                onPress={() => setTimeRange(rangeKey)}
                style={({ pressed }) => [
                  styles.rangeButton,
                  isActive && styles.rangeButtonActive,
                  pressed && styles.rangeButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    isActive && styles.rangeButtonTextActive,
                  ]}
                >
                  {TIME_RANGE_OPTIONS[rangeKey].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your day...</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>{rangeConfig.title}</Text>
              <Text style={styles.heroSubtitle}>{rangeConfig.subtitle}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Updates live</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <View
                style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}
              >
                <Ionicons name="time" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.heroValue}>
                {formatDuration(totalSecondsRange)}
              </Text>
              <Text style={styles.heroLabel}>{totalLabel}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.heroStat}>
              <View
                style={[styles.statIcon, { backgroundColor: "#FFF7ED" }]}
              >
                <Ionicons name="hourglass" size={20} color={COLORS.warning} />
              </View>
              <Text style={styles.heroValue}>{secondaryValue}</Text>
              <Text style={styles.heroLabel}>{secondaryLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>{rangeConfig.label}</Text>
              <Ionicons name="bar-chart" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>
              {formatDuration(totalSecondsRange)}
            </Text>
            <Text style={styles.statHint}>{totalHint}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Most Used</Text>
              <Ionicons
                name="phone-portrait"
                size={16}
                color={COLORS.success}
              />
            </View>
            <Text style={styles.statValue}>{mostUsedAppName}</Text>
            <Text style={styles.statHint}>{mostUsedHint}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{appsSectionTitle}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              onPress={() => setSelectedCategory("all")}
              style={[
                styles.filterChip,
                selectedCategory === "all" && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === "all" && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
            {availableCategories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {getAppCategoryLabel(category)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {showNoApps ? (
            <View style={styles.emptyCard}>
              <Ionicons name="apps" size={28} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No apps synced yet</Text>
              <Text style={styles.emptyText}>
                Connect your device to start tracking installed apps and usage.
              </Text>
            </View>
          ) : null}

          {appCards.length > 0 && filteredAppCards.length === 0 && !isLoading ? (
            <View style={styles.emptyCard}>
              <Ionicons name="filter" size={24} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No apps in this category</Text>
              <Text style={styles.emptyText}>
                Try a different category to see more apps.
              </Text>
            </View>
          ) : null}

          <View style={styles.appList}>
            {filteredAppCards.map((app) => {
              const rawPercent = Math.min(
                Math.round(app.progress * 100),
                100
              );
              const progressPercent =
                app.totalSeconds > 0 ? Math.max(rawPercent, 2) : 0;
              const usageLabel = isTodayRange
                ? `${formatDuration(app.totalSeconds)} today`
                : `${formatDuration(app.totalSeconds)} in ${rangeConfig.rangeLabel}`;
              const detailLine = `${usageLabel} | ${getAppCategoryLabel(
                app.category
              )}`;
              const secondaryParts: string[] = [];

              if (isTodayRange) {
                if (app.limitSeconds !== null) {
                  secondaryParts.push(
                    `Daily limit ${formatDuration(app.limitSeconds)}`
                  );
                  if (app.remainingSeconds !== null) {
                    secondaryParts.push(
                      `${formatDuration(app.remainingSeconds)} left`
                    );
                  }
                } else {
                  secondaryParts.push("No limit set");
                }
              } else {
                secondaryParts.push(
                  `Avg/day ${formatDuration(app.avgDailySeconds)}`
                );
                if (app.limitSeconds !== null) {
                  secondaryParts.push(
                    `Daily limit ${formatDuration(app.limitSeconds)}`
                  );
                }
              }

              if (app.totalSeconds === 0) {
                secondaryParts.push("No activity yet");
              }

              if (app.openCount > 0) {
                secondaryParts.push(`${app.openCount} opens`);
              }

              return (
                <View key={app.id} style={styles.appRow}>
                  <View style={styles.appIconRow}>
                    <View style={styles.appIcon}>
                      <Ionicons name="apps" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.appMeta}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appDetail}>{detailLine}</Text>
                      <Text style={styles.appDetailSecondary}>
                        {secondaryParts.join(" | ")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progressPercent}%` },
                          app.limitSeconds !== null &&
                            isTodayRange &&
                            app.totalSeconds > (app.limitSeconds ?? 0)
                            ? styles.progressOver
                            : null,
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
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
    backgroundColor: "#E0F2FE",
    top: -100,
    right: -100,
    opacity: 0.6,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#F0F9FF",
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
  syncCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  syncText: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    maxWidth: 220,
  },
  syncButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  syncButtonPressed: {
    opacity: 0.9,
  },
  syncButtonText: {
    fontSize: 12,
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  syncHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  syncSuccess: {
    fontSize: 12,
    color: COLORS.success,
    fontFamily: "Inter_500Medium",
  },
  syncError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  mockCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  mockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mockTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  mockText: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    maxWidth: 220,
  },
  mockButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  mockButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  mockButtonPressed: {
    opacity: 0.9,
  },
  mockButtonText: {
    fontSize: 12,
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },
  mockError: {
    fontSize: 12,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rangeButtonPressed: {
    opacity: 0.9,
  },
  rangeButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  rangeButtonTextActive: {
    color: COLORS.surface,
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
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  heroBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#166534",
    fontFamily: "Inter_600SemiBold",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  heroLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  statHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  filterChipTextActive: {
    color: COLORS.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  appList: {
    gap: 12,
  },
  appRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  appMeta: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  appDetailSecondary: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  progressContainer: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressOver: {
    backgroundColor: COLORS.warning,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    maxWidth: 240,
  },
});
