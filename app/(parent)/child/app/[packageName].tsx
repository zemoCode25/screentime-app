import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import Svg, { Path } from "react-native-svg";

import { useChildAppDetailedUsage } from "@/src/features/parent/hooks/use-child-details";
import { getAppCategoryLabel } from "@/src/utils/app-category";
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
  error: "#DC2626",
  errorLight: "#FEF2F2",
};

const CHART_COLORS = {
  night: "#1E3A8A",
  morning: "#38BDF8",
  afternoon: "#F59E0B",
  evening: "#FB7185",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const formatHourLabel = (hour: number) => {
  const hour12 = ((hour + 11) % 12) + 1;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour12}${period}`;
};

export default function ParentChildAppScreen() {
  const router = useRouter();
  const { childId, packageName } = useLocalSearchParams();
  const resolvedChildId = Array.isArray(childId) ? childId[0] : childId;
  const resolvedPackageName = Array.isArray(packageName)
    ? packageName[0]
    : packageName;

  const { data, isLoading, error } = useChildAppDetailedUsage(
    resolvedChildId,
    resolvedPackageName
  );

  const chartData = useMemo(() => {
    if (!data) {
      return null;
    }

    // Daily bar chart: last 7 days
    const last7Days = data.dailyUsage.slice(-7);
    const maxDailySeconds = Math.max(
      ...last7Days.map((d) => d.totalSeconds),
      1
    );

    const dailyBars = last7Days.map((row) => {
      const dateObj = new Date(`${row.usageDate}T00:00:00Z`);
      return {
        date: row.usageDate,
        label: DAY_LABELS[dateObj.getUTCDay()],
        value: row.totalSeconds,
        height: Math.max(
          (row.totalSeconds / maxDailySeconds) * 120,
          row.totalSeconds > 0 ? 6 : 2
        ),
      };
    });

    // Hourly aggregation for pie chart (time of day)
    const hourlyTotals = new Array(24).fill(0);
    for (const row of data.hourlyUsage) {
      if (row.hour >= 0 && row.hour < 24) {
        hourlyTotals[row.hour] += row.totalSeconds;
      }
    }

    const sumHours = (start: number, end: number) => {
      let total = 0;
      for (let hour = start; hour <= end; hour += 1) {
        total += hourlyTotals[hour] ?? 0;
      }
      return total;
    };

    const segments = [
      { label: "Night", value: sumHours(0, 5), color: CHART_COLORS.night },
      { label: "Morning", value: sumHours(6, 11), color: CHART_COLORS.morning },
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

    const totalHourlySeconds = segments.reduce((sum, s) => sum + s.value, 0);

    // Peak hour
    let peakHour = 0;
    let peakSeconds = 0;
    hourlyTotals.forEach((value, hour) => {
      if (value > peakSeconds) {
        peakSeconds = value;
        peakHour = hour;
      }
    });

    // Pie slices
    const radius = 56;
    const center = radius;
    let startAngle = 0;
    const pieSlices = segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const angle = (segment.value / totalHourlySeconds) * 360;
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

    return {
      dailyBars,
      maxDailySeconds,
      segments,
      totalHourlySeconds,
      peakHour,
      peakSeconds,
      pieSlices,
    };
  }, [data]);

  const hasData = Boolean(data);
  const hasDailyData = (chartData?.dailyBars.length ?? 0) > 0;
  const hasHourlyData = (chartData?.totalHourlySeconds ?? 0) > 0;

  if (!resolvedChildId || !resolvedPackageName) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>App not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backHome}>
          <Text style={styles.backHomeText}>Go Back</Text>
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
        <Text style={styles.headerTitle}>App Details</Text>
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
            <Text style={styles.loadingText}>Loading app statistics...</Text>
          </View>
        ) : null}

        {hasData && data ? (
          <>
            {/* App Info Header */}
            <View style={styles.appInfoCard}>
              <View style={styles.appIconLarge}>
                <Ionicons name="apps" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.appInfoText}>
                <Text style={styles.appName}>{data.appName}</Text>
                <Text style={styles.appCategory}>
                  {getAppCategoryLabel(data.category as never)}
                </Text>
                <Text style={styles.appPackage}>{data.packageName}</Text>
              </View>
            </View>

            {/* KPI Cards */}
            <Text style={styles.sectionTitle}>
              Usage Summary (Last 30 Days)
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiIconBox}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.kpiLabel}>Total Time</Text>
                <Text style={styles.kpiValue}>
                  {formatDuration(data.totalSeconds)}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconBox, { backgroundColor: "#DCFCE7" }]}
                >
                  <Ionicons
                    name="stats-chart-outline"
                    size={18}
                    color="#16A34A"
                  />
                </View>
                <Text style={styles.kpiLabel}>Daily Avg</Text>
                <Text style={styles.kpiValue}>
                  {formatDuration(data.avgDailySeconds)}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconBox, { backgroundColor: "#FEF3C7" }]}
                >
                  <Ionicons name="calendar-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.kpiLabel}>Active Days</Text>
                <Text style={styles.kpiValue}>{data.activeDays} days</Text>
              </View>

              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconBox, { backgroundColor: "#FCE7F3" }]}
                >
                  <Ionicons name="open-outline" size={18} color="#DB2777" />
                </View>
                <Text style={styles.kpiLabel}>Opens</Text>
                <Text style={styles.kpiValue}>{data.totalOpenCount}</Text>
              </View>
            </View>

            {/* Peak Hour KPI */}
            {hasHourlyData && chartData ? (
              <View style={styles.peakCard}>
                <View
                  style={[styles.kpiIconBox, { backgroundColor: "#EFF6FF" }]}
                >
                  <Ionicons
                    name="trending-up"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiLabel}>Peak Usage Hour</Text>
                  <Text style={styles.kpiValue}>
                    {formatHourLabel(chartData.peakHour)} -{" "}
                    {formatHourLabel((chartData.peakHour + 1) % 24)}
                  </Text>
                  <Text style={styles.kpiSubvalue}>
                    {formatDuration(chartData.peakSeconds)} in this window
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Daily Usage Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Daily Usage (Last 7 Days)</Text>
              {hasDailyData && chartData ? (
                <View style={styles.barChart}>
                  {chartData.dailyBars.map((bar) => (
                    <View key={bar.date} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: bar.height,
                              opacity: bar.value > 0 ? 1 : 0.3,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{bar.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.chartEmpty}>No daily usage data yet.</Text>
              )}
            </View>

            {/* Time of Day Pie Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Usage by Time of Day</Text>
              {hasHourlyData && chartData ? (
                <View style={styles.pieRow}>
                  <Svg width={112} height={112} viewBox="0 0 112 112">
                    {chartData.pieSlices.map((slice) => (
                      <Path
                        key={slice.label}
                        d={slice.path}
                        fill={slice.color}
                      />
                    ))}
                  </Svg>
                  <View style={styles.legend}>
                    {chartData.segments.map((segment) => (
                      <View key={segment.label} style={styles.legendRow}>
                        <View
                          style={[
                            styles.legendSwatch,
                            { backgroundColor: segment.color },
                          ]}
                        />
                        <View style={styles.legendTextGroup}>
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
                <Text style={styles.chartEmpty}>No hourly usage data yet.</Text>
              )}
            </View>
          </>
        ) : null}
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
    backgroundColor: "#E0F2FE",
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
    gap: 20,
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
  appInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  appIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfoText: {
    flex: 1,
    gap: 4,
  },
  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  appCategory: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: "Inter_500Medium",
  },
  appPackage: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    width: "47%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  kpiSubvalue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  peakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  chartEmpty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 20,
  },
  barChart: {
    height: 160,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  barTrack: {
    height: 140,
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
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  pieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  legend: {
    flex: 1,
    gap: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendTextGroup: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
  legendValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
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
