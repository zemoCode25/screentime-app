import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useChildApps,
  useChildProfile,
  useChildUsageDaily,
  useChildUsageHourly,
} from "@/src/features/child/hooks/use-child-data";
import {
  getAppCategoryLabel,
  resolveAppCategory,
  type AppCategory,
} from "@/src/utils/app-category";
import { formatDuration } from "@/src/utils/time";
import type { Database } from "@/types/database-types";

const COLORS = {
  primary: "#2563EB",
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

type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];

type CategorySlice = {
  key: AppCategory | "other";
  label: string;
  color: string;
  value: number;
  percent: number;
};

type HourBar = {
  label: string;
  value: number;
};

type DayBar = {
  date: string;
  label: string;
  value: number;
};

const CATEGORY_COLORS: Record<AppCategory, string> = {
  education: "#22C55E",
  games: "#F59E0B",
  video: "#F97316",
  social: "#38BDF8",
  creativity: "#F472B6",
  productivity: "#14B8A6",
  communication: "#6366F1",
  utilities: "#94A3B8",
  other: "#CBD5E1",
};

const HOUR_STARTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const HOUR_LABELS = [
  "12a",
  "2a",
  "4a",
  "6a",
  "8a",
  "10a",
  "12p",
  "2p",
  "4p",
  "6p",
  "8p",
  "10p",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const getAppName = (apps: Map<string, ChildAppRow>, packageName: string) =>
  apps.get(packageName)?.app_name ?? packageName;

const formatHourLabel = (hour: number) => {
  const period = hour >= 12 ? "p" : "a";
  const hour12 = hour % 12 || 12;
  return `${hour12}${period}`;
};

const formatHourRange = (startHour: number) => {
  const endHour = (startHour + 2) % 24;
  return `${formatHourLabel(startHour)}-${formatHourLabel(endHour)}`;
};

export default function ChildAnalyticsScreen() {
  const { data: child, isLoading: childLoading, error: childError } =
    useChildProfile();
  const childId = child?.id;
  const startDate = getDateDaysAgo(30);
  const hourlyStartDate = getDateDaysAgo(7);

  const { data: apps, isLoading: appsLoading, error: appsError } =
    useChildApps(childId);
  const { data: usageRows, isLoading: usageLoading, error: usageError } =
    useChildUsageDaily(childId, startDate);
  const { data: hourlyRows, isLoading: hourlyLoading, error: hourlyError } =
    useChildUsageHourly(childId, hourlyStartDate);

  const isLoading = childLoading || appsLoading || usageLoading || hourlyLoading;
  const error = childError ?? appsError ?? usageError ?? hourlyError;

  const {
    totalSeconds,
    avgDailySeconds,
    todayTotal,
    weekTotal,
    monthTotal,
    trendLabel,
    trendIsPositive,
    mostUsedLabel,
    mostUsedSeconds,
    behaviorLabel,
    behaviorHint,
    categorySlices,
    hourBars,
    hourMax,
    hourPeakIndex,
    hourPeakSeconds,
    dayBars,
    dayMax,
    dayPeakDate,
    dayPeakLabel,
    dayPeakSeconds,
  } = useMemo(() => {
    const appMap = new Map<string, ChildAppRow>();
    for (const app of apps ?? []) {
      appMap.set(app.package_name, app);
    }

    const categoryTotals = new Map<AppCategory, number>();
    const packageTotals = new Map<string, number>();
    const dailyTotals = new Map<string, number>();

    const todayKey = getIsoDate(new Date());
    const startDate7 = getDateDaysAgo(7);
    const startDate14 = getDateDaysAgo(14);

    let total = 0;
    let todaySum = 0;
    let weekSum = 0;
    let prevWeekSum = 0;

    for (const row of usageRows ?? []) {
      const seconds = row.total_seconds ?? 0;
      total += seconds;

      dailyTotals.set(
        row.usage_date,
        (dailyTotals.get(row.usage_date) ?? 0) + seconds
      );

      if (row.usage_date === todayKey) {
        todaySum += seconds;
      }

      if (row.usage_date >= startDate7) {
        weekSum += seconds;
      } else if (row.usage_date >= startDate14) {
        prevWeekSum += seconds;
      }

      const existingPackageTotal = packageTotals.get(row.package_name) ?? 0;
      packageTotals.set(row.package_name, existingPackageTotal + seconds);

      const resolvedCategory = resolveAppCategory(
        appMap.get(row.package_name)?.category ?? "other",
        row.package_name
      );
      const existingCategoryTotal = categoryTotals.get(resolvedCategory) ?? 0;
      categoryTotals.set(resolvedCategory, existingCategoryTotal + seconds);
    }

    const hourBuckets = Array.from({ length: 12 }, () => 0);

    for (const row of hourlyRows ?? []) {
      const hourValue = Number(row.hour);
      if (!Number.isFinite(hourValue)) {
        continue;
      }
      const index = Math.floor(hourValue / 2);
      if (index < 0 || index >= hourBuckets.length) {
        continue;
      }
      hourBuckets[index] += row.total_seconds ?? 0;
    }

    const hourMaxValue = Math.max(...hourBuckets, 1);
    const hourPeakValue = Math.max(...hourBuckets, 0);
    const hourPeakIdx = hourBuckets.findIndex(
      (value) => value === hourPeakValue
    );

    const hourSeries: HourBar[] = hourBuckets.map((value, index) => ({
      label: HOUR_LABELS[index],
      value,
    }));

    const daySeries: DayBar[] = Array.from({ length: 7 }, (_, index) => {
      const date = getDateDaysAgo(6 - index);
      const dateObj = new Date(`${date}T00:00:00Z`);
      const label = DAY_LABELS[dateObj.getUTCDay()];
      return {
        date,
        label,
        value: dailyTotals.get(date) ?? 0,
      };
    });

    const dayMaxValue = Math.max(...daySeries.map((bar) => bar.value), 1);
    const peakDay = daySeries.reduce(
      (current, next) => (next.value > current.value ? next : current),
      daySeries[0]
    );

    let topPackage: string | null = null;
    let topPackageSeconds = 0;

    for (const [packageName, seconds] of packageTotals.entries()) {
      if (seconds > topPackageSeconds) {
        topPackage = packageName;
        topPackageSeconds = seconds;
      }
    }

    const avgSeconds = total / 30;

    let behavior = "Balanced";
    let behaviorDetail = "A steady mix of screen time.";

    if (total <= 0) {
      behavior = "No data";
      behaviorDetail = "Use your device to start tracking insights.";
    } else {
      const sortedCategories = Array.from(categoryTotals.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      const topCategory = sortedCategories[0];
      const topShare = topCategory ? topCategory[1] / total : 0;
      const avgHours = avgSeconds / 3600;

      if (topCategory && topShare >= 0.45) {
        const label = getAppCategoryLabel(topCategory[0]);
        behavior = `${label} focused`;
        behaviorDetail = `Most of your time is in ${label.toLowerCase()} apps.`;
      } else if (avgHours >= 4) {
        behavior = "High usage";
        behaviorDetail = "Consider taking more breaks today.";
      } else if (avgHours < 2) {
        behavior = "Light usage";
        behaviorDetail = "Plenty of offline time today.";
      }
    }

    const trendDelta = weekSum - prevWeekSum;
    const trendPercent =
      prevWeekSum > 0 ? Math.round((trendDelta / prevWeekSum) * 100) : null;

    let trendText = "No data";
    if (prevWeekSum === 0 && weekSum > 0) {
      trendText = "New";
    } else if (trendPercent !== null) {
      trendText = `${trendPercent >= 0 ? "+" : ""}${trendPercent}%`;
    }

    const sortedCategoryTotals = Array.from(categoryTotals.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Separate "other" from regular categories
    const nonOtherCategories = sortedCategoryTotals.filter(
      ([key]) => key !== "other"
    );
    const otherCategoryTotal = categoryTotals.get("other") ?? 0;

    const topCategories = nonOtherCategories.slice(0, 4);
    const topTotal = topCategories.reduce((sum, entry) => sum + entry[1], 0);
    const remainingTotal = Math.max(total - topTotal - otherCategoryTotal, 0);
    const combinedOtherTotal = otherCategoryTotal + remainingTotal;

    const slices: CategorySlice[] = topCategories.map(([key, value]) => ({
      key,
      label: getAppCategoryLabel(key),
      color: CATEGORY_COLORS[key],
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

    if (combinedOtherTotal > 0) {
      slices.push({
        key: "other",
        label: getAppCategoryLabel("other"),
        color: CATEGORY_COLORS.other,
        value: combinedOtherTotal,
        percent: total > 0 ? Math.round((combinedOtherTotal / total) * 100) : 0,
      });
    }

    const mostUsed = topPackage
      ? getAppName(appMap, topPackage)
      : "No usage yet";

    return {
      totalSeconds: total,
      avgDailySeconds: avgSeconds,
      todayTotal: todaySum,
      weekTotal: weekSum,
      monthTotal: total,
      trendLabel: trendText,
      trendIsPositive: trendDelta >= 0,
      mostUsedLabel: mostUsed,
      mostUsedSeconds: topPackageSeconds,
      behaviorLabel: behavior,
      behaviorHint: behaviorDetail,
      categorySlices: slices,
      hourBars: hourSeries,
      hourMax: hourMaxValue,
      hourPeakIndex: hourPeakIdx,
      hourPeakSeconds: hourPeakValue,
      dayBars: daySeries,
      dayMax: dayMaxValue,
      dayPeakDate: peakDay.date,
      dayPeakLabel: peakDay.label,
      dayPeakSeconds: peakDay.value,
    };
  }, [apps, hourlyRows, usageRows]);

  const barData = [
    { label: "Today", value: todayTotal },
    { label: "7 days", value: weekTotal },
    { label: "30 days", value: monthTotal },
  ];

  const maxBarValue = Math.max(...barData.map((bar) => bar.value), 1);
  const hasHourlyData = hourPeakSeconds > 0;
  const hasDailyData = dayBars.some((bar) => bar.value > 0);
  const hourPeakLabel =
    hourPeakIndex >= 0 ? formatHourRange(HOUR_STARTS[hourPeakIndex]) : "N/A";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Analytics</Text>
            <Text style={styles.subtitle}>Last 30 days</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="pulse" size={16} color={COLORS.primary} />
            <Text style={styles.headerBadgeText}>Live</Text>
          </View>
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
            <Text style={styles.loadingText}>Crunching insights...</Text>
          </View>
        ) : null}

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Daily</Text>
            <Text style={styles.kpiValue}>
              {formatDuration(avgDailySeconds)}
            </Text>
            <View style={styles.kpiTrendRow}>
              <Ionicons
                name={trendIsPositive ? "arrow-up" : "arrow-down"}
                size={14}
                color={trendIsPositive ? COLORS.success : COLORS.warning}
              />
              <Text
                style={[
                  styles.kpiTrend,
                  trendIsPositive ? styles.trendPositive : styles.trendNegative,
                ]}
              >
                {trendLabel}
              </Text>
              <Text style={styles.kpiTrendSub}>vs last week</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Most Used</Text>
            <Text style={styles.kpiValue}>{mostUsedLabel}</Text>
            <Text style={styles.kpiSub}>
              {formatDuration(mostUsedSeconds)} total
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Behavior</Text>
            <Text style={styles.kpiValue}>{behaviorLabel}</Text>
            <Text style={styles.kpiSub}>{behaviorHint}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Category distribution</Text>
            <Text style={styles.chartSubtitle}>Share of total usage</Text>
          </View>

          <View style={styles.chartRow}>
            <View style={styles.pieChart}>
              {categorySlices.length === 0 ? (
                <View style={styles.pieEmpty}>
                  <Ionicons
                    name="pie-chart"
                    size={28}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.pieEmptyText}>No data yet</Text>
                </View>
              ) : (
                categorySlices.map((slice) => (
                  <View
                    key={slice.key}
                    style={[
                      styles.pieSlice,
                      {
                        flexGrow: slice.value,
                        backgroundColor: slice.color,
                      },
                    ]}
                  />
                ))
              )}
            </View>

            <View style={styles.legend}>
              {categorySlices.map((slice) => (
                <View key={slice.key} style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: slice.color },
                    ]}
                  />
                  <View style={styles.legendTextGroup}>
                    <Text style={styles.legendLabel}>{slice.label}</Text>
                    <Text style={styles.legendValue}>{slice.percent}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Totals</Text>
            <Text style={styles.chartSubtitle}>Time spent over time</Text>
          </View>

          <View style={styles.barChart}>
            {barData.map((bar) => (
              <View key={bar.label} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${(bar.value / maxBarValue) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>
                  {formatDuration(bar.value)}
                </Text>
                <Text style={styles.barLabel}>{bar.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Active hours</Text>
            <Text style={styles.chartSubtitle}>Peak usage by time of day</Text>
          </View>

          {!hasHourlyData ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="time" size={28} color={COLORS.textSecondary} />
              <Text style={styles.chartEmptyText}>No hourly data yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.hourChart}>
                {hourBars.map((bar, index) => {
                  const heightPercent = Math.max(
                    Math.round((bar.value / hourMax) * 100),
                    bar.value > 0 ? 6 : 0
                  );
                  return (
                    <View key={bar.label} style={styles.hourBarTrack}>
                      <View
                        style={[
                          styles.hourBarFill,
                          { height: `${heightPercent}%` },
                          index === hourPeakIndex ? styles.hourBarPeak : null,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <View style={styles.hourLabels}>
                {HOUR_LABELS.map((label) => (
                  <Text key={label} style={styles.hourLabel}>
                    {label}
                  </Text>
                ))}
              </View>
              <Text style={styles.chartNote}>
                Peak window: {hourPeakLabel} (
                {formatDuration(hourPeakSeconds)})
              </Text>
            </>
          )}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Active days</Text>
            <Text style={styles.chartSubtitle}>Last 7 days</Text>
          </View>

          {!hasDailyData ? (
            <View style={styles.chartEmpty}>
              <Ionicons
                name="calendar"
                size={28}
                color={COLORS.textSecondary}
              />
              <Text style={styles.chartEmptyText}>No daily data yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.dayChart}>
                {dayBars.map((bar) => (
                  <View key={bar.date} style={styles.dayItem}>
                    <View style={styles.dayTrack}>
                      <View
                        style={[
                          styles.dayFill,
                          { height: `${(bar.value / dayMax) * 100}%` },
                          bar.date === dayPeakDate
                            ? styles.dayFillPeak
                            : null,
                        ]}
                      />
                    </View>
                    <Text style={styles.dayLabel}>{bar.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.chartNote}>
                Most active: {dayPeakLabel} ({formatDuration(dayPeakSeconds)})
              </Text>
            </>
          )}
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
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E0F2FE",
    top: -80,
    right: -90,
    opacity: 0.5,
  },
  backgroundGlowBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F0F9FF",
    bottom: -90,
    left: -100,
    opacity: 0.5,
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
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  headerBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
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
  kpiGrid: {
    gap: 16,
  },
  kpiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  kpiSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  kpiTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kpiTrend: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  trendPositive: {
    color: COLORS.success,
  },
  trendNegative: {
    color: COLORS.warning,
  },
  kpiTrendSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  chartHeader: {
    gap: 4,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  chartSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chartRow: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    flexWrap: "wrap",
  },
  pieChart: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  pieSlice: {
    height: "100%",
    flexBasis: 0,
  },
  pieEmpty: {
    alignItems: "center",
    gap: 6,
  },
  pieEmptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  legend: {
    flex: 1,
    gap: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendTextGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  legendValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  barChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  barTrack: {
    height: 120,
    width: 30,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  barValue: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  barLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chartEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  chartEmptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  chartNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  hourChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    gap: 6,
  },
  hourBarTrack: {
    flex: 1,
    maxWidth: 14,
    height: "100%",
    justifyContent: "flex-end",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    overflow: "hidden",
  },
  hourBarFill: {
    width: "100%",
    backgroundColor: COLORS.primaryLight,
  },
  hourBarPeak: {
    backgroundColor: COLORS.primary,
  },
  hourLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  hourLabel: {
    flex: 1,
    maxWidth: 14,
    textAlign: "center",
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  dayChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  dayItem: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  dayTrack: {
    height: 110,
    width: 26,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  dayFill: {
    width: "100%",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
  },
  dayFillPeak: {
    backgroundColor: COLORS.primary,
  },
  dayLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
});
