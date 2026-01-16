import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "@/src/features/auth/hooks/use-auth";
import {
  useChildApps,
  useChildLimits,
  useChildProfile,
  useChildUsageDaily,
  useChildUsageHourly,
} from "@/src/features/child/hooks/use-child-data";
import { calculateBlockedPackages } from "@/src/features/child/services/blocking-enforcement";
import { type AppLimitRow } from "@/src/features/child/services/child-service";
import { syncChildDeviceUsage } from "@/src/features/child/services/device-usage-sync";
import { fetchActiveOverrides } from "@/src/features/child/services/override-service";
import { canUseUsageStats, setBlockedPackages } from "@/src/lib/usage-stats";
import {
  APP_CATEGORY_ORDER,
  getAppCategoryLabel,
  resolveAppCategory,
  type AppCategory,
} from "@/src/utils/app-category";
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

const CHART_COLORS = {
  night: "#1E3A8A",
  morning: "#38BDF8",
  afternoon: "#F59E0B",
  evening: "#FB7185",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatHourLabel = (hour: number) => {
  const hour12 = ((hour + 11) % 12) + 1;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour12} ${period}`;
};

const formatHourRangeLabel = (hour: number) => {
  const nextHour = (hour + 1) % 24;
  return `${formatHourLabel(hour)}-${formatHourLabel(nextHour)}`;
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describePieSlice = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];
type AppBase = Pick<
  ChildAppRow,
  "id" | "app_name" | "category" | "package_name" | "icon_path" | "icon_url"
>;

type AppCard = {
  id: string;
  name: string;
  packageName: string;
  category: AppCategory;
  iconUrl: string | null;
  totalSeconds: number;
  avgDailySeconds: number;
  openCount: number;
  limitSeconds: number | null;
  remainingSeconds: number | null;
  progress: number;
  sortValue: number;
};

const getIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
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

const Skeleton = ({
  style,
  borderRadius = 12,
}: {
  style?: any;
  borderRadius?: number;
}) => {
  const opacity = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: "#CBD5E1", opacity, borderRadius }, style]}
    />
  );
};

const ChildDashboardSkeleton = () => {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Skeleton style={{ width: 48, height: 48 }} borderRadius={16} />
            <View style={{ gap: 8 }}>
              <Skeleton style={{ width: 100, height: 24 }} borderRadius={6} />
              <Skeleton style={{ width: 60, height: 16 }} borderRadius={4} />
            </View>
          </View>
          <Skeleton style={{ width: 40, height: 40 }} borderRadius={20} />
        </View>

        {/* Sync Card */}
        <Skeleton style={{ width: "100%", height: 80 }} borderRadius={18} />

        {/* Range Tabs */}
        <View style={styles.rangeRow}>
          <Skeleton style={{ flex: 1, height: 36 }} borderRadius={999} />
          <Skeleton style={{ flex: 1, height: 36 }} borderRadius={999} />
          <Skeleton style={{ flex: 1, height: 36 }} borderRadius={999} />
        </View>

        {/* Hero Card / Stats */}
        <Skeleton style={{ width: "100%", height: 180 }} borderRadius={24} />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Skeleton style={{ flex: 1, height: 100 }} borderRadius={20} />
          <Skeleton style={{ flex: 1, height: 100 }} borderRadius={20} />
        </View>

        {/* Apps Section */}
        <View style={{ gap: 16, marginTop: 10 }}>
          <Skeleton style={{ width: 140, height: 24 }} borderRadius={6} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton style={{ width: 60, height: 30 }} borderRadius={999} />
            <Skeleton style={{ width: 80, height: 30 }} borderRadius={999} />
            <Skeleton style={{ width: 70, height: 30 }} borderRadius={999} />
          </View>
          <Skeleton style={{ width: "100%", height: 72 }} borderRadius={16} />
          <Skeleton style={{ width: "100%", height: 72 }} borderRadius={16} />
          <Skeleton style={{ width: "100%", height: 72 }} borderRadius={16} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function ChildHomeScreen() {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("today");
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | "all">(
    "all"
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [visibleAppCount, setVisibleAppCount] = useState(15);
  const {
    data: child,
    isLoading: childLoading,
    error: childError,
  } = useChildProfile();
  const childId = child?.id;
  const today = useMemo(() => new Date(), []);
  const rangeConfig = TIME_RANGE_OPTIONS[timeRange];
  const rangeDays = rangeConfig.days;
  const startDate = getDateDaysAgo(rangeDays - 1);
  const isTodayRange = timeRange === "today";

  const {
    data: apps,
    isLoading: appsLoading,
    error: appsError,
  } = useChildApps(childId);
  const {
    data: usageRows,
    isLoading: usageLoading,
    error: usageError,
  } = useChildUsageDaily(childId, startDate);

  const {
    data: usageHourlyRows,
    isLoading: usageHourlyLoading,
    error: usageHourlyError,
  } = useChildUsageHourly(childId, startDate);
  const {
    data: limits,
    isLoading: limitsLoading,
    error: limitsError,
  } = useChildLimits(childId);

  const isLoading =
    childLoading ||
    appsLoading ||
    usageLoading ||
    usageHourlyLoading ||
    limitsLoading;
  const error =
    childError ?? appsError ?? usageError ?? usageHourlyError ?? limitsError;

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
            category: "other" as const,
            package_name: packageName,
            icon_path: null,
            icon_url: null,
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
          iconUrl: app.icon_url ?? null,
          totalSeconds: usage.totalSeconds,
          avgDailySeconds,
          openCount: usage.openCount,
          limitSeconds,
          remainingSeconds,
          progress,
          sortValue: usageForProgress,
        };
      })
      .filter((card) => {
        if (apps && apps.length > 0) {
          return true;
        }
        return card.totalSeconds > 0 || card.limitSeconds !== null;
      })
      .sort((a, b) => {
        const aActive = a.sortValue > 0;
        const bActive = b.sortValue > 0;
        if (aActive !== bActive) {
          return aActive ? -1 : 1;
        }
        if (b.sortValue !== a.sortValue) {
          return b.sortValue - a.sortValue;
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

  const filteredAppCards = useMemo(
    () =>
      selectedCategory === "all"
        ? appCards
        : appCards.filter((card) => card.category === selectedCategory),
    [appCards, selectedCategory]
  );

  const visibleAppCards = useMemo(
    () => filteredAppCards.slice(0, visibleAppCount),
    [filteredAppCards, visibleAppCount]
  );

  const hasMoreApps = filteredAppCards.length > visibleAppCount;

  const greetingName = child?.name ?? profile?.display_name ?? "there";

  const selectableApps = filteredAppCards;

  useEffect(() => {
    if (selectableApps.length === 0) {
      if (selectedAppId !== null) {
        setSelectedAppId(null);
      }
      return;
    }

    if (
      !selectedAppId ||
      !selectableApps.some((card) => card.id === selectedAppId)
    ) {
      setSelectedAppId(selectableApps[0].id);
    }
  }, [selectableApps, selectedAppId]);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleAppCount(15);
  }, [selectedCategory]);

  const selectedApp = useMemo(() => {
    if (selectableApps.length === 0) {
      return null;
    }
    if (!selectedAppId) {
      return selectableApps[0];
    }
    return (
      selectableApps.find((card) => card.id === selectedAppId) ??
      selectableApps[0]
    );
  }, [selectableApps, selectedAppId]);

  const selectedUsageDetails = useMemo(() => {
    if (!selectedApp) {
      return null;
    }

    const usageByDate = new Map<string, number>();
    for (const row of usageRows ?? []) {
      if (row.package_name !== selectedApp.packageName) {
        continue;
      }
      const totalSeconds = row.total_seconds ?? 0;
      if (totalSeconds <= 0) {
        continue;
      }
      usageByDate.set(
        row.usage_date,
        (usageByDate.get(row.usage_date) ?? 0) + totalSeconds
      );
    }

    const rangeSeries = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (rangeDays - 1 - index));
      const dateKey = getIsoDate(date);
      const seconds = usageByDate.get(dateKey) ?? 0;
      const label =
        rangeDays <= 7
          ? DAY_LABELS[date.getDay()]
          : `${date.getMonth() + 1}/${date.getDate()}`;
      return { dateKey, seconds, label };
    });

    const totalSecondsRange = rangeSeries.reduce(
      (sum, entry) => sum + entry.seconds,
      0
    );
    const maxDailySeconds = Math.max(
      ...rangeSeries.map((entry) => entry.seconds),
      1
    );

    const hourlyTotals = new Array(24).fill(0);
    for (const row of usageHourlyRows ?? []) {
      if (row.package_name !== selectedApp.packageName) {
        continue;
      }
      const hour = row.hour ?? 0;
      if (hour < 0 || hour > 23) {
        continue;
      }
      hourlyTotals[hour] += row.total_seconds ?? 0;
    }

    let peakHour = 0;
    let peakSeconds = 0;
    hourlyTotals.forEach((value, hour) => {
      if (value > peakSeconds) {
        peakSeconds = value;
        peakHour = hour;
      }
    });

    const totalHourlySeconds = hourlyTotals.reduce(
      (sum, value) => sum + value,
      0
    );

    const sumHours = (start: number, end: number) => {
      let total = 0;
      for (let hour = start; hour <= end; hour += 1) {
        total += hourlyTotals[hour] ?? 0;
      }
      return total;
    };

    const segments = [
      {
        label: "Night",
        value: sumHours(0, 5),
        color: CHART_COLORS.night,
      },
      {
        label: "Morning",
        value: sumHours(6, 11),
        color: CHART_COLORS.morning,
      },
      {
        label: "Afternoon",
        value: sumHours(12, 17),
        color: CHART_COLORS.afternoon,
      },
      {
        label: "Evening",
        value: sumHours(18, 23),
        color: CHART_COLORS.evening,
      },
    ];

    return {
      rangeSeries,
      totalSecondsRange,
      maxDailySeconds,
      avgDailySeconds: totalSecondsRange / rangeDays,
      peakHour,
      peakSeconds,
      totalHourlySeconds,
      segments,
    };
  }, [rangeDays, selectedApp, today, usageHourlyRows, usageRows]);

  const pieSlices = useMemo(() => {
    if (!selectedUsageDetails || selectedUsageDetails.totalHourlySeconds <= 0) {
      return [];
    }

    const radius = 48;
    const center = radius;
    let startAngle = 0;
    return selectedUsageDetails.segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const angle =
          (segment.value / selectedUsageDetails.totalHourlySeconds) * 360;
        const endAngle = startAngle + angle;
        const path = describePieSlice(
          center,
          center,
          radius,
          startAngle,
          endAngle
        );
        const slice = {
          label: segment.label,
          value: segment.value,
          color: segment.color,
          path,
        };
        startAngle = endAngle;
        return slice;
      });
  }, [selectedUsageDetails]);

  if (isLoading) {
    return <ChildDashboardSkeleton />;
  }

  const handleSignOut = () => {
    void signOut();
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
        setSyncError("Enable Usage Access in Settings, then tap Sync again.");
        return;
      }
      setSyncMessage(
        `Synced ${result.appsSynced} apps and ${result.usageRows} usage rows.`
      );
      await queryClient.invalidateQueries({ queryKey: ["child"] });

      // Update app blocking enforcement
      await updateBlockingEnforcement(childId);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Failed to sync device usage."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const updateBlockingEnforcement = async (childId: string) => {
    try {
      // Fetch necessary data
      const [limits, overrides, usageData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["child", "limits", childId],
          queryFn: async () => {
            const { data, error } = await (
              await import("@/lib/supabase")
            ).supabase
              .from("app_limits")
              .select("*")
              .eq("child_id", childId);
            if (error) throw error;
            return data ?? [];
          },
        }),
        fetchActiveOverrides(childId),
        queryClient.fetchQuery({
          queryKey: ["child", "usage-daily", childId, "today"],
          queryFn: async () => {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const todayDate = `${year}-${month}-${day}`;

            const { data, error } = await (
              await import("@/lib/supabase")
            ).supabase
              .from("app_usage_daily")
              .select("package_name,total_seconds")
              .eq("child_id", childId)
              .eq("usage_date", todayDate);

            if (error) throw error;
            return data ?? [];
          },
        }),
      ]);

      // Build usage map for today
      const usageToday = new Map<string, number>();
      for (const row of usageData) {
        usageToday.set(row.package_name, row.total_seconds ?? 0);
      }

      // Calculate which apps should be blocked
      const blockedPackages = calculateBlockedPackages(
        limits,
        usageToday,
        overrides
      );

      // Update native module with blocked packages
      await setBlockedPackages(blockedPackages);

      console.log(
        `Blocking enforcement updated: ${blockedPackages.length} apps blocked`
      );
    } catch (err) {
      console.error("Failed to update blocking enforcement:", err);
      // Don't throw - blocking enforcement is optional, don't break sync
    }
  };

  const handleLoadMore = () => {
    setVisibleAppCount((prev) => prev + 15);
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
  const showNoApps = !hasAppCatalog && appCards.length === 0 && !isLoading;
  const canSyncDevice = Boolean(childId) && canUseUsageStats();
  const hasHourlyData = (selectedUsageDetails?.totalHourlySeconds ?? 0) > 0;
  const barLabelStep = selectedUsageDetails
    ? Math.max(1, Math.ceil(selectedUsageDetails.rangeSeries.length / 6))
    : 1;

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
            <View style={{ flex: 1 }}>
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
              <View style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="time" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.heroValue}>
                {formatDuration(totalSecondsRange)}
              </Text>
              <Text style={styles.heroLabel}>{totalLabel}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.heroStat}>
              <View style={[styles.statIcon, { backgroundColor: "#FFF7ED" }]}>
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

          {selectedApp && selectedUsageDetails ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleGroup}>
                  <Text style={styles.detailTitle}>{selectedApp.name}</Text>
                  <Text style={styles.detailSubtitle}>
                    {getAppCategoryLabel(selectedApp.category)} |{" "}
                    {selectedApp.packageName}
                  </Text>
                </View>
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>Selected</Text>
                </View>
              </View>
              <Text style={styles.detailTotal}>
                Total {rangeConfig.rangeLabel}:{" "}
                {formatDuration(selectedUsageDetails.totalSecondsRange)}
              </Text>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <View style={styles.kpiIconBox}>
                    <Ionicons
                      name="stats-chart-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.kpiLabel}>Avg per day</Text>
                  <Text style={styles.kpiValue}>
                    {formatDuration(selectedUsageDetails.avgDailySeconds)}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <View
                    style={[styles.kpiIconBox, { backgroundColor: "#FEF3C7" }]}
                  >
                    <Ionicons name="time-outline" size={16} color="#D97706" />
                  </View>
                  <Text style={styles.kpiLabel}>Most active</Text>
                  <Text style={styles.kpiValue}>
                    {hasHourlyData
                      ? formatHourRangeLabel(selectedUsageDetails.peakHour)
                      : "No data"}
                  </Text>
                  <Text style={styles.kpiSubvalue}>
                    {hasHourlyData
                      ? formatDuration(selectedUsageDetails.peakSeconds)
                      : "No hourly usage yet"}
                  </Text>
                </View>
              </View>

              <View style={styles.chartStack}>
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Usage by time of day</Text>
                  {hasHourlyData ? (
                    <View style={styles.pieRow}>
                      <Svg width={96} height={96} viewBox="0 0 96 96">
                        {pieSlices.map((slice) => (
                          <Path
                            key={slice.label}
                            d={slice.path}
                            fill={slice.color}
                          />
                        ))}
                      </Svg>
                      <View style={styles.legend}>
                        {selectedUsageDetails.segments.map((segment) => (
                          <View key={segment.label} style={styles.legendRow}>
                            <View
                              style={[
                                styles.legendSwatch,
                                { backgroundColor: segment.color },
                              ]}
                            />
                            <View>
                              <Text style={styles.legendLabel}>
                                {segment.label}
                              </Text>
                              <Text style={styles.legendValue}>
                                {formatDuration(segment.value)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.chartEmpty}>No hourly usage yet.</Text>
                  )}
                </View>

                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Daily usage</Text>
                  <View style={styles.barChart}>
                    {selectedUsageDetails.rangeSeries.map((entry, index) => {
                      const height =
                        entry.seconds <= 0
                          ? 2
                          : Math.max(
                              6,
                              (entry.seconds /
                                selectedUsageDetails.maxDailySeconds) *
                                120
                            );
                      const showLabel =
                        index % barLabelStep === 0 ||
                        index === selectedUsageDetails.rangeSeries.length - 1;
                      return (
                        <View key={entry.dateKey} style={styles.barColumn}>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height,
                                  opacity: entry.seconds > 0 ? 1 : 0.4,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.barLabel,
                              !showLabel && styles.barLabelMuted,
                            ]}
                          >
                            {showLabel ? entry.label : " "}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {showNoApps ? (
            <View style={styles.emptyCard}>
              <Ionicons name="apps" size={28} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No apps synced yet</Text>
              <Text style={styles.emptyText}>
                Connect your device to start tracking installed apps and usage.
              </Text>
            </View>
          ) : null}

          {appCards.length > 0 &&
          filteredAppCards.length === 0 &&
          !isLoading ? (
            <View style={styles.emptyCard}>
              <Ionicons name="filter" size={24} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No apps in this category</Text>
              <Text style={styles.emptyText}>
                Try a different category to see more apps.
              </Text>
            </View>
          ) : null}

          <View style={styles.appList}>
            {visibleAppCards.map((app, index) => {
              const rawPercent = Math.min(Math.round(app.progress * 100), 100);
              const progressPercent =
                app.totalSeconds > 0 ? Math.max(rawPercent, 2) : 0;
              const usageLabel = isTodayRange
                ? `${formatDuration(app.totalSeconds)} today`
                : `${formatDuration(app.totalSeconds)} in ${
                    rangeConfig.rangeLabel
                  }`;
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

              const isSelected = selectedApp?.id === app.id;

              return (
                <Pressable
                  key={app.id}
                  onPress={() => setSelectedAppId(app.id)}
                  style={({ pressed }) => [
                    styles.appRow,
                    isSelected && styles.appRowActive,
                    pressed && styles.appRowPressed,
                  ]}
                >
                  <View style={styles.appIconRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.appIcon}>
                      {app.iconUrl ? (
                        <Image
                          source={{ uri: app.iconUrl }}
                          style={styles.appIconImage}
                        />
                      ) : (
                        <Ionicons
                          name="apps"
                          size={18}
                          color={COLORS.primary}
                        />
                      )}
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
                </Pressable>
              );
            })}
          </View>

          {hasMoreApps ? (
            <Pressable
              onPress={handleLoadMore}
              style={({ pressed }) => [
                styles.loadMoreButton,
                pressed && styles.loadMoreButtonPressed,
              ]}
            >
              <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
              <Text style={styles.loadMoreText}>
                Load more ({filteredAppCards.length - visibleAppCount}{" "}
                remaining)
              </Text>
            </Pressable>
          ) : filteredAppCards.length > 15 ? (
            <View style={styles.allLoadedCard}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.success}
              />
              <Text style={styles.allLoadedText}>
                All {filteredAppCards.length} apps loaded
              </Text>
            </View>
          ) : null}
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
  detailCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  detailTitleGroup: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  detailSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  detailBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  detailBadgeText: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  detailTotal: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  kpiSubvalue: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chartStack: {
    gap: 12,
  },
  chartCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  chartTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  pieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  legendValue: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  chartEmpty: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  barChart: {
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  barTrack: {
    height: 120,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: "60%",
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  barLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  barLabelMuted: {
    opacity: 0,
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
  appRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  appRowPressed: {
    opacity: 0.9,
  },
  appIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  appIconImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    marginTop: 4,
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
    marginTop: 4,
  },
  allLoadedText: {
    fontSize: 13,
    color: COLORS.success,
    fontFamily: "Inter_500Medium",
  },
});
