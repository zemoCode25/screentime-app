import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { AIInsightsResponse, BehavioralInsight } from "../types/ai-responses";
import { HealthScoreRing } from "./HealthScoreRing";

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
  info: "#3B82F6",
};

interface AIInsightsCardProps {
  insights: AIInsightsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onPress?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function getInsightIcon(type: BehavioralInsight["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "pattern":
      return "analytics-outline";
    case "concern":
      return "alert-circle-outline";
    case "positive":
      return "checkmark-circle-outline";
    case "recommendation":
      return "bulb-outline";
    default:
      return "information-circle-outline";
  }
}

function getInsightColor(type: BehavioralInsight["type"], severity?: BehavioralInsight["severity"]): string {
  if (type === "concern") {
    if (severity === "critical") return COLORS.error;
    if (severity === "warning") return COLORS.warning;
    return COLORS.warning;
  }
  if (type === "positive") return COLORS.success;
  if (type === "recommendation") return COLORS.primary;
  return COLORS.info;
}

function getTrendIcon(trend: AIInsightsResponse["weeklyTrend"]): keyof typeof Ionicons.glyphMap {
  switch (trend) {
    case "increasing":
      return "trending-up";
    case "decreasing":
      return "trending-down";
    case "stable":
      return "remove-outline";
    default:
      return "remove-outline";
  }
}

function getTrendColor(trend: AIInsightsResponse["weeklyTrend"]): string {
  switch (trend) {
    case "increasing":
      return COLORS.warning;
    case "decreasing":
      return COLORS.success;
    case "stable":
      return COLORS.textSecondary;
    default:
      return COLORS.textSecondary;
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function AIInsightsCard({
  insights,
  isLoading,
  error,
  onPress,
  onRefresh,
  isRefreshing,
}: AIInsightsCardProps) {
  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={24} color={COLORS.error} />
          <Text style={styles.errorText}>Unable to load AI insights</Text>
          {onRefresh && (
            <Pressable onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Analyzing usage patterns...</Text>
        </View>
      </View>
    );
  }

  if (!insights) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyContent}>
          <Ionicons name="sparkles-outline" size={28} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptyText}>
            Collect more usage data to get AI-powered insights
          </Text>
        </View>
      </View>
    );
  }

  // Get the most important insight to display
  const topInsight =
    insights.behavioralInsights.find((i) => i.type === "concern") ||
    insights.behavioralInsights.find((i) => i.type === "recommendation") ||
    insights.behavioralInsights[0];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiIconBadge}>
            <Ionicons name="sparkles" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>AI Insights</Text>
        </View>
        {onRefresh && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
            ]}
            hitSlop={8}
          >
            {isRefreshing ? (
              <ActivityIndicator size={14} color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.mainContent}>
        <HealthScoreRing score={insights.overallHealthScore} size={90} />

        <View style={styles.statsColumn}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Daily Avg</Text>
              <Text style={styles.statValue}>
                {formatMinutes(insights.totalDailyAverageMinutes)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Trend</Text>
              <View style={styles.trendRow}>
                <Ionicons
                  name={getTrendIcon(insights.weeklyTrend)}
                  size={16}
                  color={getTrendColor(insights.weeklyTrend)}
                />
                <Text
                  style={[
                    styles.trendText,
                    { color: getTrendColor(insights.weeklyTrend) },
                  ]}
                >
                  {insights.weeklyTrend}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.suggestionsBadge}>
            <Ionicons name="bulb-outline" size={14} color={COLORS.primary} />
            <Text style={styles.suggestionsText}>
              {insights.limitSuggestions.length} limit suggestions
            </Text>
          </View>
        </View>
      </View>

      {topInsight && (
        <View style={styles.insightPreview}>
          <View
            style={[
              styles.insightIcon,
              { backgroundColor: `${getInsightColor(topInsight.type, topInsight.severity)}15` },
            ]}
          >
            <Ionicons
              name={getInsightIcon(topInsight.type)}
              size={16}
              color={getInsightColor(topInsight.type, topInsight.severity)}
            />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle} numberOfLines={1}>
              {topInsight.title}
            </Text>
            <Text style={styles.insightDescription} numberOfLines={2}>
              {topInsight.description}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Tap for full analysis</Text>
        <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    backgroundColor: "#BFDBFE",
  },
  mainContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  statsColumn: {
    flex: 1,
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  suggestionsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  suggestionsText: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  insightPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  insightContent: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  insightDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  // Loading state
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  // Error state
  errorContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    fontFamily: "Inter_500Medium",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  // Empty state
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 220,
  },
});
