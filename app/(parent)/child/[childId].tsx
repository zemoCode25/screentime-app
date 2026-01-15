import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useChildApps,
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

  const childQuery = useChildDetails(resolvedChildId);
  const usageQuery = useChildUsageSummary(resolvedChildId);
  const appsQuery = useChildApps(resolvedChildId);

  const isLoading =
    childQuery.isLoading || usageQuery.isLoading || appsQuery.isLoading;
  const error =
    childQuery.error || usageQuery.error || appsQuery.error || null;

  const child = childQuery.data;
  const usage = usageQuery.data;
  const apps = appsQuery.data ?? [];

  const appNameMap = new Map(
    apps.map((app) => [app.package_name, app.app_name])
  );

  const mostUsedApp = usage?.mostUsedPackage
    ? appNameMap.get(usage.mostUsedPackage) ?? usage.mostUsedPackage
    : "No data yet";

  if (!resolvedChildId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Child not found</Text>
        <Pressable
          onPress={() => router.replace("/(parent)/home")}
          style={styles.backHome}
        >
          <Text style={styles.backHomeText}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundGlow} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Child Overview</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.error} />
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
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childMeta}>
              Age {child.age}
              {child.grade_level ? ` - ${child.grade_level}` : ""}
            </Text>
            <View style={styles.tagRow}>
              {child.interests.map((interest) => (
                <View key={interest} style={styles.tag}>
                  <Text style={styles.tagText}>{interest}</Text>
                </View>
              ))}
            </View>
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
        ) : null}

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Avg 30d</Text>
            <Text style={styles.metricValue}>
              {formatDuration(usage?.avgDailySeconds ?? 0)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total 30d</Text>
            <Text style={styles.metricValue}>
              {formatDuration(usage?.totalSeconds ?? 0)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active days</Text>
            <Text style={styles.metricValue}>{usage?.activeDays ?? 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Most used app</Text>
            <Text style={styles.metricValue}>{mostUsedApp}</Text>
          </View>
        </View>

        <View style={styles.appsSection}>
          <View style={styles.appsHeader}>
            <Text style={styles.sectionTitle}>Apps used</Text>
            <Text style={styles.sectionSubtitle}>{apps.length} apps</Text>
          </View>
          {apps.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No apps yet</Text>
              <Text style={styles.emptyText}>
                App usage will appear once the device syncs.
              </Text>
            </View>
          ) : (
            apps.map((app) => (
              <View key={app.id} style={styles.appRow}>
                <View style={styles.appIcon}>
                  <Ionicons name="apps" size={16} color={COLORS.primary} />
                </View>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{app.app_name}</Text>
                  <Text style={styles.appMeta}>
                    {formatLabel(app.category)} - {app.package_name}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonPressed: {
    backgroundColor: COLORS.primaryLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
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
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  profileCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  childName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "Inter_700Bold",
  },
  childMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontFamily: "Inter_500Medium",
  },
  tagSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1F5FF",
  },
  tagSecondaryText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    width: "48%",
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appsSection: {
    gap: 12,
  },
  appsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  emptyCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  appMeta: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    fontFamily: "Inter_600SemiBold",
  },
  backHome: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  backHomeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
