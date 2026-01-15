import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
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
import { formatDuration } from "@/src/utils/time";
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

type AppCard = {
  id: string;
  name: string;
  packageName: string;
  category: string;
  totalSeconds: number;
  openCount: number;
  limitSeconds: number | null;
  remainingSeconds: number | null;
  progress: number;
};

const getIsoDate = (date: Date) => date.toISOString().slice(0, 10);

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
  const { data: child, isLoading: childLoading, error: childError } =
    useChildProfile();
  const childId = child?.id;
  const today = new Date();
  const todayDate = getIsoDate(today);

  const { data: apps, isLoading: appsLoading, error: appsError } =
    useChildApps(childId);
  const { data: usageRows, isLoading: usageLoading, error: usageError } =
    useChildUsageDaily(childId, todayDate);
  const { data: limits, isLoading: limitsLoading, error: limitsError } =
    useChildLimits(childId);

  const isLoading =
    childLoading || appsLoading || usageLoading || limitsLoading;
  const error = childError ?? appsError ?? usageError ?? limitsError;

  const {
    appCards,
    totalSecondsToday,
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

    const baseApps: ChildAppRow[] =
      apps && apps.length > 0
        ? apps
        : Array.from(usageByPackage.keys()).map((packageName) => ({
            id: packageName,
            app_name: packageName,
            category: "other",
            package_name: packageName,
            icon_path: null,
          }));

    const maxUsage = Math.max(
      ...baseApps.map(
        (app) => usageByPackage.get(app.package_name)?.totalSeconds ?? 0
      ),
      1
    );

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
        const remainingSeconds =
          limitSeconds !== null
            ? Math.max(limitSeconds - usage.totalSeconds, 0)
            : null;

        if (limitSeconds !== null) {
          totalLimitSeconds += limitSeconds;
          totalRemainingSeconds += remainingSeconds ?? 0;
        }

        const progress = limitSeconds
          ? Math.min(usage.totalSeconds / limitSeconds, 1)
          : usage.totalSeconds / maxUsage;

        return {
          id: app.id,
          name: app.app_name,
          packageName: app.package_name,
          category: app.category,
          totalSeconds: usage.totalSeconds,
          openCount: usage.open_count,
          limitSeconds,
          remainingSeconds,
          progress,
        };
      })
      .filter((card) => card.totalSeconds > 0 || card.limitSeconds !== null)
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return {
      appCards: cards,
      totalSecondsToday: totalSeconds,
      remainingSeconds: totalRemainingSeconds,
      hasLimits: totalLimitSeconds > 0,
      appsUsed: usedAppsCount,
      mostUsedAppName: topAppName,
    };
  }, [apps, limits, today, usageRows]);

  const greetingName = child?.name ?? profile?.display_name ?? "there";

  const handleSignOut = () => {
    void signOut();
  };

  const secondaryValue = hasLimits
    ? formatDuration(remainingSeconds)
    : `${appsUsed} apps`;
  const secondaryLabel = hasLimits ? "Remaining" : "Apps used";

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
              <Text style={styles.heroTitle}>Today at a glance</Text>
              <Text style={styles.heroSubtitle}>Your live progress</Text>
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
                {formatDuration(totalSecondsToday)}
              </Text>
              <Text style={styles.heroLabel}>Used today</Text>
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
              <Text style={styles.statLabel}>Today</Text>
              <Ionicons name="bar-chart" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>
              {formatDuration(totalSecondsToday)}
            </Text>
            <Text style={styles.statHint}>Total screen time</Text>
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
            <Text style={styles.statHint}>Top app today</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Apps today</Text>
          </View>

          {appCards.length === 0 && !isLoading ? (
            <View style={styles.emptyCard}>
              <Ionicons name="apps" size={28} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No app usage yet</Text>
              <Text style={styles.emptyText}>
                Once you use your device today, activity will show here.
              </Text>
            </View>
          ) : null}

          <View style={styles.appList}>
            {appCards.map((app) => {
              const rawPercent = Math.min(
                Math.round(app.progress * 100),
                100
              );
              const progressPercent = app.totalSeconds > 0 ?
                Math.max(rawPercent, 2) : 0;

              return (
                <View key={app.id} style={styles.appRow}>
                  <View style={styles.appIconRow}>
                    <View style={styles.appIcon}>
                      <Ionicons name="apps" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.appMeta}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appDetail}>
                        {formatDuration(app.totalSeconds)} today
                        {app.limitSeconds !== null
                          ? ` | Limit ${formatDuration(app.limitSeconds)}`
                          : " | No limit"}
                      </Text>
                      <Text style={styles.appDetailSecondary}>
                        {app.remainingSeconds !== null
                          ? `${formatDuration(app.remainingSeconds)} left`
                          : "No limit set"}
                        {app.openCount > 0
                          ? ` | ${app.openCount} opens`
                          : ""}
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
