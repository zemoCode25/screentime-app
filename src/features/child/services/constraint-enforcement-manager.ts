import { AppState, type AppStateStatus } from "react-native";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

import {
  canUseAccessibility,
  checkAccessibilityEnabled,
  fetchInstalledApps,
  fetchUsageStats,
  setAppLimits,
  setBlockedPackagesWithReasons,
  setTimeRules,
  setDailyLimitSettings,
  type TimeRule,
} from "@/src/lib/usage-stats";

import {
  cancelAllConstraintAlarms,
  configureNotifications,
  scheduleConstraintAlarms,
} from "./alarm-scheduler";
import {
  BlockedPackageWithReason,
  calculateAllBlockedPackages,
} from "./blocking-enforcement";
import { fetchChildConstraints } from "./child-service";

type AppLimitRow = Database["public"]["Tables"]["app_limits"]["Row"];
type AppAccessOverrideRow =
  Database["public"]["Tables"]["app_access_overrides"]["Row"];
type ChildTimeRuleRow = Database["public"]["Tables"]["child_time_rules"]["Row"];
type ChildUsageSettingsRow =
  Database["public"]["Tables"]["child_usage_settings"]["Row"];

/**
 * Fetches app limits for a child
 */
async function fetchAppLimits(childId: string): Promise<AppLimitRow[]> {
  const { data, error } = await supabase
    .from("app_limits")
    .select("*")
    .eq("child_id", childId);

  if (error) {
    console.error("[EnforcementManager] Failed to fetch app limits:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetches active access overrides for a child
 */
async function fetchActiveOverrides(
  childId: string
): Promise<AppAccessOverrideRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("app_access_overrides")
    .select("*")
    .eq("child_id", childId)
    .eq("status", "active")
    .gt("expires_at", now);

  if (error) {
    console.error("[EnforcementManager] Failed to fetch overrides:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetches today's usage directly from the device (real-time data).
 * This uses Android UsageStats API instead of the database to get accurate,
 * up-to-date usage information for enforcement decisions.
 */
async function fetchTodayUsageFromDevice(): Promise<Map<string, number>> {
  const now = new Date();
  // Start of today (midnight)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimeMs = startOfDay.getTime();
  const endTimeMs = now.getTime();

  try {
    const stats = await fetchUsageStats(startTimeMs, endTimeMs);

    const usageMap = new Map<string, number>();
    for (const stat of stats) {
      // Convert milliseconds to seconds
      const totalSeconds = Math.round((stat.totalTimeMs ?? 0) / 1000);
      if (totalSeconds > 0) {
        usageMap.set(stat.packageName, totalSeconds);
      }
    }

    console.log(
      "[EnforcementManager] Fetched device usage for",
      usageMap.size,
      "apps"
    );
    return usageMap;
  } catch (error) {
    console.error(
      "[EnforcementManager] Failed to fetch device usage:",
      error
    );
    return new Map();
  }
}

/**
 * Event-driven manager for evaluating and enforcing screen time constraints.
 *
 * Unlike a polling approach, this manager only evaluates constraints when:
 * 1. The app comes to the foreground (user opens the app)
 * 2. A manual sync is triggered
 * 3. Constraints are updated from the parent
 *
 * This approach saves battery by eliminating the 60-second polling interval.
 */
class ConstraintEnforcementManager {
  private childId: string | null = null;
  private isEvaluating = false;
  private lastBlockedPackages: BlockedPackageWithReason[] = [];
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  private lastAppState: AppStateStatus = "unknown";
  private isStarted = false;

  /**
   * Start the enforcement manager for a child.
   * Sets up event listeners for app state changes and schedules alarms.
   */
  async start(childId: string): Promise<void> {
    if (this.childId === childId && this.isStarted) {
      // Already running for this child
      return;
    }

    await this.stop();
    this.childId = childId;
    this.isStarted = true;
    this.lastAppState = AppState.currentState;

    console.log(
      "[EnforcementManager] Starting event-driven mode for child:",
      childId
    );

    // Configure notifications for alarm scheduling
    await configureNotifications();

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );

    // Run initial evaluation (this will also schedule alarms)
    await this.evaluateNow();
  }

  /**
   * Stop the enforcement manager and clean up listeners.
   */
  async stop(): Promise<void> {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Cancel all scheduled alarms
    await cancelAllConstraintAlarms();

    this.childId = null;
    this.isEvaluating = false;
    this.isStarted = false;
    console.log("[EnforcementManager] Stopped");
  }

  /**
   * Handle app state changes (foreground/background transitions).
   * Triggers evaluation when the app comes to the foreground.
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    // Only trigger evaluation when coming FROM background TO foreground
    if (
      (this.lastAppState === "background" ||
        this.lastAppState === "inactive") &&
      nextAppState === "active"
    ) {
      console.log(
        "[EnforcementManager] App came to foreground, evaluating constraints"
      );
      this.evaluateNow();
    }
    this.lastAppState = nextAppState;
  };

  /**
   * Trigger an immediate evaluation.
   * Call this after:
   * - Usage data sync completes
   * - Parent updates constraints
   * - Manual refresh
   */
  async evaluateNow(): Promise<void> {
    if (!this.childId) {
      console.log("[EnforcementManager] No child ID set, skipping evaluation");
      return;
    }

    if (this.isEvaluating) {
      console.log("[EnforcementManager] Already evaluating, skipping");
      return;
    }

    this.isEvaluating = true;

    try {
      await this.evaluate();
    } catch (error) {
      console.error("[EnforcementManager] Evaluation failed:", error);
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * Called when constraints are updated from the parent.
   * This allows real-time updates without waiting for the next foreground event.
   */
  async onConstraintsUpdated(): Promise<void> {
    console.log(
      "[EnforcementManager] Constraints updated by parent, re-evaluating"
    );
    await this.evaluateNow();
  }

  /**
   * Get the last calculated blocked packages with reasons
   */
  getLastBlockedPackages(): BlockedPackageWithReason[] {
    return this.lastBlockedPackages;
  }

  /**
   * Check if the manager is currently active
   */
  isActive(): boolean {
    return this.isStarted && this.childId !== null;
  }

  /**
   * Main evaluation logic
   */
  private async evaluate(): Promise<void> {
    const childId = this.childId;
    if (!childId) {
      return;
    }

    // Check if accessibility service is available and enabled
    if (!canUseAccessibility()) {
      console.log(
        "[EnforcementManager] Accessibility not available on this platform"
      );
      return;
    }

    if (!checkAccessibilityEnabled()) {
      console.log(
        "[EnforcementManager] Accessibility service not enabled, skipping"
      );
      return;
    }

    console.log("[EnforcementManager] Evaluating constraints for:", childId);

    // Fetch all required data in parallel
    // IMPORTANT: usageToday is fetched from device (real-time) not database
    // This ensures accurate enforcement even if sync hasn't run recently
    const [constraints, appLimits, overrides, usageToday, installedApps] =
      await Promise.all([
        fetchChildConstraints(childId),
        fetchAppLimits(childId),
        fetchActiveOverrides(childId),
        fetchTodayUsageFromDevice(),
        fetchInstalledApps(),
      ]);

    // Get all package names from installed apps
    const allPackages = installedApps.map((app) => app.packageName);

    // Convert constraint types to match expected interface
    const timeRules = constraints.timeRules as ChildTimeRuleRow[];
    const usageSettings =
      constraints.usageSettings as ChildUsageSettingsRow | null;

    // Schedule alarms for bedtime/focus time transitions
    if (timeRules.length > 0) {
      await scheduleConstraintAlarms(timeRules, () => {
        console.log("[EnforcementManager] Alarm triggered, re-evaluating");
        this.evaluateNow();
      });
    }

    // Push time rules to native for real-time enforcement
    // This allows native to check bedtime/focus even when JS side hasn't recalculated
    if (timeRules.length > 0) {
      const nativeTimeRules: TimeRule[] = timeRules.map((rule) => ({
        ruleType: rule.rule_type as "bedtime" | "focus",
        startSeconds: rule.start_seconds,
        endSeconds: rule.end_seconds,
        days: rule.days,
      }));
      console.log(
        "[EnforcementManager] Pushing time rules to native:",
        nativeTimeRules.length
      );
      await setTimeRules(nativeTimeRules);
    }

    // Push daily limit settings to native for real-time enforcement
    if (usageSettings && usageSettings.daily_limit_seconds > 0) {
      console.log(
        "[EnforcementManager] Pushing daily limit to native:",
        usageSettings.daily_limit_seconds,
        "bonus:",
        usageSettings.weekend_bonus_seconds
      );
      await setDailyLimitSettings({
        limitSeconds: usageSettings.daily_limit_seconds,
        weekendBonusSeconds: usageSettings.weekend_bonus_seconds,
      });
    }

    // Calculate blocked packages with reasons
    const blockedPackages = calculateAllBlockedPackages(
      appLimits,
      usageToday,
      overrides,
      timeRules,
      usageSettings,
      allPackages
    );

    this.lastBlockedPackages = blockedPackages;

    console.log(
      "[EnforcementManager] Blocked packages:",
      blockedPackages.length,
      blockedPackages.slice(0, 5).map((p) => `${p.packageName}:${p.reason}`)
    );

    // Update native module with blocked packages and reasons
    await setBlockedPackagesWithReasons(blockedPackages);

    // Send total daily limits to native service for apps that apply today
    // The native accessibility service will query UsageStatsManager for real-time
    // usage and calculate accurate remaining time when the user opens each app
    const appLimitsForToday: Record<string, number> = {};
    const dayOfWeek = new Date().getDay();
    const dayToFlag: Record<number, keyof AppLimitRow> = {
      0: "applies_sun",
      1: "applies_mon",
      2: "applies_tue",
      3: "applies_wed",
      4: "applies_thu",
      5: "applies_fri",
      6: "applies_sat",
    };

    for (const limit of appLimits) {
      const dayFlag = dayToFlag[dayOfWeek];
      if (!limit[dayFlag]) continue; // Limit doesn't apply today

      // Send total limit (native side calculates remaining using real-time usage)
      appLimitsForToday[limit.package_name] = limit.limit_seconds;
    }

    if (Object.keys(appLimitsForToday).length > 0) {
      console.log(
        "[EnforcementManager] Setting app limits for native timers:",
        Object.keys(appLimitsForToday).length,
        "apps"
      );
      await setAppLimits(appLimitsForToday);
    }
  }
}

// Export singleton instance
export const constraintEnforcementManager = new ConstraintEnforcementManager();
