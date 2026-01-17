import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppLimitSuggestion } from "../types/ai-responses";

const COLORS = {
  primary: "#2563EB",
  primaryLight: "#DBEAFE",
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
};

interface LimitSuggestionCardProps {
  suggestion: AppLimitSuggestion;
  onApply?: (suggestion: AppLimitSuggestion) => void;
  onDismiss?: (suggestion: AppLimitSuggestion) => void;
  isApplying?: boolean;
}

function getPriorityColor(priority: AppLimitSuggestion["priority"]) {
  switch (priority) {
    case "high":
      return { bg: COLORS.errorLight, text: COLORS.error };
    case "medium":
      return { bg: COLORS.warningLight, text: COLORS.warning };
    case "low":
      return { bg: COLORS.successLight, text: COLORS.success };
    default:
      return { bg: COLORS.primaryLight, text: COLORS.primary };
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function LimitSuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  isApplying,
}: LimitSuggestionCardProps) {
  const priorityColors = getPriorityColor(suggestion.priority);
  const reduction = suggestion.currentUsageMinutes - suggestion.suggestedLimitMinutes;
  const reductionPercent = Math.round(
    (reduction / suggestion.currentUsageMinutes) * 100
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.appInfo}>
          <View style={styles.appIcon}>
            <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.appDetails}>
            <Text style={styles.appName} numberOfLines={1}>
              {suggestion.appName}
            </Text>
            <Text style={styles.appCategory}>
              {formatCategory(suggestion.category)}
            </Text>
          </View>
        </View>
        <View
          style={[styles.priorityBadge, { backgroundColor: priorityColors.bg }]}
        >
          <Text style={[styles.priorityText, { color: priorityColors.text }]}>
            {suggestion.priority}
          </Text>
        </View>
      </View>

      <View style={styles.limitComparison}>
        <View style={styles.limitItem}>
          <Text style={styles.limitLabel}>Current Avg</Text>
          <Text style={styles.limitValue}>
            {formatMinutes(suggestion.currentUsageMinutes)}
          </Text>
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          {reduction > 0 && (
            <View style={styles.reductionBadge}>
              <Text style={styles.reductionText}>-{reductionPercent}%</Text>
            </View>
          )}
        </View>

        <View style={styles.limitItem}>
          <Text style={styles.limitLabel}>Suggested</Text>
          <Text style={[styles.limitValue, styles.suggestedValue]}>
            {formatMinutes(suggestion.suggestedLimitMinutes)}
          </Text>
        </View>
      </View>

      <View style={styles.reasoningBox}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={COLORS.textSecondary}
        />
        <Text style={styles.reasoningText}>{suggestion.reasoning}</Text>
      </View>

      <View style={styles.actions}>
        {onDismiss && (
          <Pressable
            onPress={() => onDismiss(suggestion)}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.dismissButtonPressed,
            ]}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        )}
        {onApply && (
          <Pressable
            onPress={() => onApply(suggestion)}
            style={({ pressed }) => [
              styles.applyButton,
              pressed && styles.applyButtonPressed,
              isApplying && styles.applyButtonDisabled,
            ]}
            disabled={isApplying}
          >
            {isApplying ? (
              <Text style={styles.applyText}>Applying...</Text>
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={COLORS.surface} />
                <Text style={styles.applyText}>Apply Limit</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Compact version for list display
interface LimitSuggestionRowProps {
  suggestion: AppLimitSuggestion;
  onPress?: (suggestion: AppLimitSuggestion) => void;
}

export function LimitSuggestionRow({
  suggestion,
  onPress,
}: LimitSuggestionRowProps) {
  const priorityColors = getPriorityColor(suggestion.priority);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress?.(suggestion)}
    >
      <View style={styles.rowAppIcon}>
        <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowAppName} numberOfLines={1}>
          {suggestion.appName}
        </Text>
        <Text style={styles.rowLimit}>
          {formatMinutes(suggestion.currentUsageMinutes)} →{" "}
          <Text style={styles.rowSuggested}>
            {formatMinutes(suggestion.suggestedLimitMinutes)}
          </Text>
        </Text>
      </View>

      <View
        style={[
          styles.rowPriorityDot,
          { backgroundColor: priorityColors.text },
        ]}
      />

      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full card styles
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  appDetails: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appCategory: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  limitComparison: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
  },
  limitItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  limitLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  limitValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  suggestedValue: {
    color: COLORS.primary,
  },
  arrowContainer: {
    alignItems: "center",
    gap: 4,
  },
  reductionBadge: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reductionText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.success,
    fontFamily: "Inter_600SemiBold",
  },
  reasoningBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
  },
  reasoningText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  dismissButtonPressed: {
    backgroundColor: "#E2E8F0",
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  applyButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonPressed: {
    backgroundColor: "#1D4ED8",
  },
  applyButtonDisabled: {
    backgroundColor: "#93C5FD",
  },
  applyText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.surface,
    fontFamily: "Inter_600SemiBold",
  },

  // Row styles (compact)
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowPressed: {
    backgroundColor: "#F8FAFC",
  },
  rowAppIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowAppName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  rowLimit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  rowSuggested: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  rowPriorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
