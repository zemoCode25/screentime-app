import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  AIInsightsResponse,
  AppLimitSuggestion,
  BehavioralInsight,
} from "../types/ai-responses";
import { HealthScoreRing } from "./HealthScoreRing";
import { LimitSuggestionCard, LimitSuggestionRow } from "./LimitSuggestionCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLORS = {
  primary: "#2563EB",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
};

type TabKey = "overview" | "suggestions" | "patterns";

interface InsightsSheetProps {
  visible: boolean;
  onClose: () => void;
  insights: AIInsightsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onApplyLimit?: (suggestion: AppLimitSuggestion) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function getInsightIcon(
  type: BehavioralInsight["type"],
): keyof typeof Ionicons.glyphMap {
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

function getInsightColors(
  type: BehavioralInsight["type"],
  severity?: BehavioralInsight["severity"],
) {
  if (type === "concern") {
    if (severity === "critical")
      return { bg: COLORS.errorLight, text: COLORS.error };
    return { bg: COLORS.warningLight, text: COLORS.warning };
  }
  if (type === "positive")
    return { bg: COLORS.successLight, text: COLORS.success };
  if (type === "recommendation")
    return { bg: COLORS.primaryLight, text: COLORS.primary };
  return { bg: COLORS.infoLight, text: COLORS.info };
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function InsightsSheet({
  visible,
  onClose,
  insights,
  isLoading,
  error,
  onApplyLimit,
  onRefresh,
  isRefreshing,
}: InsightsSheetProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<AppLimitSuggestion | null>(null);

  const tabs: {
    key: TabKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "overview", label: "Overview", icon: "pie-chart-outline" },
    { key: "suggestions", label: "Suggestions", icon: "bulb-outline" },
    { key: "patterns", label: "Patterns", icon: "analytics-outline" },
  ];

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Analyzing usage patterns...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>Unable to load insights</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          {onRefresh && (
            <Pressable onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          )}
        </View>
      );
    }

    if (!insights) {
      return (
        <View style={styles.centerContent}>
          <Ionicons
            name="sparkles-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No insights available</Text>
          <Text style={styles.emptyMessage}>
            More usage data is needed to generate AI insights
          </Text>
        </View>
      );
    }

    if (selectedSuggestion) {
      return (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <Pressable
              onPress={() => setSelectedSuggestion(null)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
              <Text style={styles.backText}>Back to Suggestions</Text>
            </Pressable>
          </View>
          <LimitSuggestionCard
            suggestion={selectedSuggestion}
            onApply={onApplyLimit}
            onDismiss={() => setSelectedSuggestion(null)}
          />
        </ScrollView>
      );
    }

    switch (activeTab) {
      case "overview":
        return (
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Health Score Section */}
            <View style={styles.section}>
              <View style={styles.healthScoreCard}>
                <HealthScoreRing
                  score={insights.overallHealthScore}
                  size={110}
                />
                <View style={styles.healthScoreInfo}>
                  <Text style={styles.healthScoreLabel}>
                    Screen Time Health
                  </Text>
                  <Text style={styles.healthScoreDescription}>
                    Based on {insights.childAge}-year-old usage guidelines
                  </Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statPill}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={COLORS.primary}
                      />
                      <Text style={styles.statPillText}>
                        {formatMinutes(insights.totalDailyAverageMinutes)}/day
                      </Text>
                    </View>
                    <View style={styles.statPill}>
                      <Ionicons
                        name={
                          insights.weeklyTrend === "increasing"
                            ? "trending-up"
                            : insights.weeklyTrend === "decreasing"
                              ? "trending-down"
                              : "remove-outline"
                        }
                        size={14}
                        color={
                          insights.weeklyTrend === "increasing"
                            ? COLORS.warning
                            : insights.weeklyTrend === "decreasing"
                              ? COLORS.success
                              : COLORS.textSecondary
                        }
                      />
                      <Text style={styles.statPillText}>
                        {insights.weeklyTrend}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Recommendations Section */}
            {insights.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                <View style={styles.recommendationsList}>
                  {insights.recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.recommendationBullet}>
                        <Text style={styles.recommendationBulletText}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Quick Actions */}
            {insights.limitSuggestions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <Pressable
                    onPress={() => setActiveTab("suggestions")}
                    style={styles.seeAllButton}
                  >
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={COLORS.primary}
                    />
                  </Pressable>
                </View>
                <View style={styles.quickActionsList}>
                  {insights.limitSuggestions
                    .filter((s) => s.priority === "high")
                    .slice(0, 2)
                    .map((suggestion, index) => (
                      <LimitSuggestionRow
                        key={index}
                        suggestion={suggestion}
                        onPress={setSelectedSuggestion}
                      />
                    ))}
                </View>
              </View>
            )}
          </ScrollView>
        );

      case "suggestions":
        return (
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Limit Suggestions ({insights.limitSuggestions.length})
              </Text>
              <Text style={styles.sectionDescription}>
                AI-recommended limits based on usage patterns and age guidelines
              </Text>

              {/* Group by priority */}
              {["high", "medium", "low"].map((priority) => {
                const suggestions = insights.limitSuggestions.filter(
                  (s) => s.priority === priority,
                );
                if (suggestions.length === 0) return null;

                return (
                  <View key={priority} style={styles.priorityGroup}>
                    <Text style={styles.priorityLabel}>
                      {priority === "high"
                        ? "High Priority"
                        : priority === "medium"
                          ? "Medium Priority"
                          : "Low Priority"}
                    </Text>
                    <View style={styles.suggestionsList}>
                      {suggestions.map((suggestion, index) => (
                        <LimitSuggestionRow
                          key={index}
                          suggestion={suggestion}
                          onPress={setSelectedSuggestion}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );

      case "patterns":
        return (
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Behavioral Insights</Text>
              <Text style={styles.sectionDescription}>
                Patterns and observations from usage analysis
              </Text>

              <View style={styles.insightsList}>
                {insights.behavioralInsights.map((insight, index) => {
                  const colors = getInsightColors(
                    insight.type,
                    insight.severity,
                  );
                  return (
                    <View key={index} style={styles.insightCard}>
                      <View
                        style={[
                          styles.insightIconBox,
                          { backgroundColor: colors.bg },
                        ]}
                      >
                        <Ionicons
                          name={getInsightIcon(insight.type)}
                          size={20}
                          color={colors.text}
                        />
                      </View>
                      <View style={styles.insightContent}>
                        <View style={styles.insightHeader}>
                          <Text style={styles.insightTitle}>
                            {insight.title}
                          </Text>
                          <View
                            style={[
                              styles.insightTypeBadge,
                              { backgroundColor: colors.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.insightTypeText,
                                { color: colors.text },
                              ]}
                            >
                              {insight.type}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.insightDescription}>
                          {insight.description}
                        </Text>
                        {insight.relatedApps.length > 0 && (
                          <View style={styles.relatedApps}>
                            <Text style={styles.relatedAppsLabel}>
                              Related apps:
                            </Text>
                            <Text style={styles.relatedAppsList}>
                              {insight.relatedApps.join(", ")}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.aiIconBadge}>
                <Ionicons name="sparkles" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.headerTitle}>AI Insights</Text>
            </View>
            <View style={styles.headerActions}>
              {onRefresh && (
                <Pressable
                  onPress={onRefresh}
                  style={({ pressed }) => [
                    styles.refreshButton,
                    pressed && styles.refreshButtonPressed,
                  ]}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size={16} color={COLORS.primary} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={COLORS.primary} />
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          {insights && !selectedSuggestion && (
            <View style={styles.tabsContainer}>
              {tabs.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.tabActive,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={
                      activeTab === tab.key
                        ? COLORS.primary
                        : COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.key && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    backgroundColor: "#BFDBFE",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    backgroundColor: COLORS.border,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  tabTextActive: {
    color: COLORS.primary,
  },

  // Content
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 260,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: "Inter_600SemiBold",
  },

  // Health Score
  healthScoreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  healthScoreInfo: {
    flex: 1,
    gap: 6,
  },
  healthScoreLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  healthScoreDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    maxWidth: "100%",
  },
  statPillText: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },

  // Recommendations
  recommendationsList: {
    gap: 10,
  },
  recommendationItem: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recommendationBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationBulletText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },

  // Quick Actions
  quickActionsList: {
    gap: 10,
  },

  // Suggestions
  priorityGroup: {
    marginBottom: 20,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  suggestionsList: {
    gap: 10,
  },

  // Insights
  insightsList: {
    gap: 12,
  },
  insightCard: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  insightIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  insightContent: {
    flex: 1,
    gap: 6,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  insightTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  insightTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  insightTypeText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  insightDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  relatedApps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  relatedAppsLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  relatedAppsList: {
    fontSize: 11,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },

  // Back button
  backRow: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: "Inter_500Medium",
  },
});
