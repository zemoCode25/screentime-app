import { AppState, type AppStateStatus } from "react-native";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

import {
  canUseAccessibility,
  // DND mode
  canUseDnd,
  checkAccessibilityEnabled,
  disableDndMode,
  enableDndMode,
  fetchInstalledApps,
  fetchUsageStats,
  isDndAccessGranted,
  setAppLimits,
  setBlockedPackagesWithReasons,
  setDailyLimitSettings,
  setTimeRules,
  type TimeRule,
} from "@/src/lib/usage-stats";

import {
  cancelAllConstraintAlarms,
  configureNotifications,
  scheduleConstraintAlarms,
  showAppLimitReachedNotification,
  showDailyLimitReachedNotification,
  showLimitWarningNotification,
} from "./alarm-scheduler";
import {
  BlockedPackageWithReason,
  calculateAllBlockedPackages,
} from "./blocking-enforcement";
import { fetchChildConstraints } from "./child-service";
import { isWithinBedtime } from "./constraint-utils";

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
  childId: string,
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
      "apps",
    );
    return usageMap;
  } catch (error) {
    console.error("[EnforcementManager] Failed to fetch device usage:", error);
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
  // Track packages we've already notified about to avoid duplicate notifications
  private notifiedAppLimits = new Set<string>();
  private notifiedDailyLimit = false;
  private notifiedWarnings = new Set<string>();
  // Store app names for notifications
  private appNameCache = new Map<string, string>();
  // Track if we enabled DND mode (to not disable if user enabled it manually)
  private dndEnabledByUs = false;

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
      childId,
    );

    // Configure notifications for alarm scheduling
    await configureNotifications();

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
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

    // Disable DND if we enabled it
    if (this.dndEnabledByUs && canUseDnd() && isDndAccessGranted()) {
      console.log("[EnforcementManager] Disabling DND on stop");
      await disableDndMode();
      this.dndEnabledByUs = false;
    }

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
        "[EnforcementManager] App came to foreground, evaluating constraints",
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
      "[EnforcementManager] Constraints updated by parent, re-evaluating",
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
        "[EnforcementManager] Accessibility not available on this platform",
      );
      return;
    }

    if (!checkAccessibilityEnabled()) {
      console.log(
        "[EnforcementManager] Accessibility service not enabled, skipping",
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
        nativeTimeRules.length,
      );
      await setTimeRules(nativeTimeRules);
    }

    // Push daily limit settings to native for real-time enforcement
    if (usageSettings && usageSettings.daily_limit_seconds > 0) {
      console.log(
        "[EnforcementManager] Pushing daily limit to native:",
        usageSettings.daily_limit_seconds,
        "bonus:",
        usageSettings.weekend_bonus_seconds,
      );
      await setDailyLimitSettings({
        limitSeconds: usageSettings.daily_limit_seconds,
        weekendBonusSeconds: usageSettings.weekend_bonus_seconds,
      });
    }

    // Update app name cache for notifications
    for (const app of installedApps) {
      this.appNameCache.set(app.packageName, app.appName);
    }

    // Calculate blocked packages with reasons
    const blockedPackages = calculateAllBlockedPackages(
      appLimits,
      usageToday,
      overrides,
      timeRules,
      usageSettings,
      allPackages,
    );

    this.lastBlockedPackages = blockedPackages;

    console.log(
      "[EnforcementManager] Blocked packages:",
      blockedPackages.length,
      blockedPackages.slice(0, 5).map((p) => `${p.packageName}:${p.reason}`),
    );

    // Send notifications for newly blocked packages
    await this.sendBlockNotifications(
      blockedPackages,
      appLimits,
      usageToday,
      usageSettings,
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
        "apps",
      );
      await setAppLimits(appLimitsForToday);
    }

    // Manage Do Not Disturb mode based on bedtime status
    await this.manageDndMode(timeRules);
  }

  /**
   * Manages Do Not Disturb mode based on whether bedtime is currently active.
   * Enables DND when bedtime starts, disables it when bedtime ends.
   */
  private async manageDndMode(timeRules: ChildTimeRuleRow[]): Promise<void> {
    // Check if DND is available and permission granted
    if (!canUseDnd()) {
      return;
    }

    if (!isDndAccessGranted()) {
      console.log(
        "[EnforcementManager] DND access not granted, skipping DND management",
      );
      return;
    }

    const now = new Date();
    const bedtimeActive = isWithinBedtime(timeRules, now);

    if (bedtimeActive && !this.dndEnabledByUs) {
      // Bedtime just started, enable DND
      console.log("[EnforcementManager] Bedtime active, enabling DND mode");
      const success = await enableDndMode();
      if (success) {
        this.dndEnabledByUs = true;
        console.log("[EnforcementManager] DND mode enabled for bedtime");
      } else {
        console.warn("[EnforcementManager] Failed to enable DND mode");
      }
    } else if (!bedtimeActive && this.dndEnabledByUs) {
      // Bedtime just ended, disable DND
      console.log("[EnforcementManager] Bedtime ended, disabling DND mode");
      const success = await disableDndMode();
      if (success) {
        this.dndEnabledByUs = false;
        console.log("[EnforcementManager] DND mode disabled after bedtime");
      } else {
        console.warn("[EnforcementManager] Failed to disable DND mode");
      }
    }
  }

  /**
   * Sends notifications for newly blocked packages and approaching limits
   */
  private async sendBlockNotifications(
    blockedPackages: BlockedPackageWithReason[],
    appLimits: AppLimitRow[],
    usageToday: Map<string, number>,
    usageSettings: ChildUsageSettingsRow | null,
  ): Promise<void> {
    // Check for daily limit exceeded notification
    const hasDailyLimitBlocked = blockedPackages.some(
      (pkg) => pkg.reason === "daily_limit",
    );
    if (hasDailyLimitBlocked && !this.notifiedDailyLimit) {
      this.notifiedDailyLimit = true;
      const limitMinutes = Math.round(
        (usageSettings?.daily_limit_seconds ?? 0) / 60,
      );
      await showDailyLimitReachedNotification(limitMinutes);
    }

    // Check for per-app limit exceeded notifications
    for (const blocked of blockedPackages) {
      if (blocked.reason === "app_limit") {
        if (!this.notifiedAppLimits.has(blocked.packageName)) {
          this.notifiedAppLimits.add(blocked.packageName);
          const appName =
            this.appNameCache.get(blocked.packageName) ?? blocked.packageName;
          await showAppLimitReachedNotification(appName, blocked.packageName);
        }
      }
    }

    // Check for 5-minute warnings on apps that aren't blocked yet
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
      if (!limit[dayFlag]) continue;

      // Skip if already blocked
      if (
        blockedPackages.some((pkg) => pkg.packageName === limit.package_name)
      ) {
        continue;
      }

      const usedSeconds = usageToday.get(limit.package_name) ?? 0;
      const remainingSeconds = limit.limit_seconds - usedSeconds;
      const remainingMinutes = Math.round(remainingSeconds / 60);

      // Show 5-minute warning
      if (remainingMinutes === 5) {
        const warningKey = `app_${limit.package_name}`;
        if (!this.notifiedWarnings.has(warningKey)) {
          this.notifiedWarnings.add(warningKey);
          const appName =
            this.appNameCache.get(limit.package_name) ?? limit.package_name;
          await showLimitWarningNotification("app", appName, 5);
        }
      }
    }

    // Check for daily limit 5-minute warning
    if (
      usageSettings &&
      usageSettings.daily_limit_seconds > 0 &&
      !hasDailyLimitBlocked
    ) {
      let totalUsedSeconds = 0;
      for (const seconds of usageToday.values()) {
        totalUsedSeconds += seconds;
      }

      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const bonusSeconds = isWeekend
        ? (usageSettings.weekend_bonus_seconds ?? 0)
        : 0;
      const effectiveLimit = usageSettings.daily_limit_seconds + bonusSeconds;

      const remainingSeconds = effectiveLimit - totalUsedSeconds;
      const remainingMinutes = Math.round(remainingSeconds / 60);

      if (remainingMinutes === 5 && !this.notifiedWarnings.has("daily_limit")) {
        this.notifiedWarnings.add("daily_limit");
        await showLimitWarningNotification("daily", "Screen Time", 5);
      }
    }
  }

  /**
   * Reset daily notification tracking (call at midnight)
   */
  resetDailyNotifications(): void {
    this.notifiedAppLimits.clear();
    this.notifiedDailyLimit = false;
    this.notifiedWarnings.clear();
    console.log("[EnforcementManager] Reset daily notification tracking");
  }
}

// Export singleton instance
export const constraintEnforcementManager = new ConstraintEnforcementManager();
