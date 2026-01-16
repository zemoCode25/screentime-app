import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

import {
  canUseAccessibility,
  checkAccessibilityEnabled,
  fetchInstalledApps,
  setBlockedPackagesWithReasons,
} from "@/src/lib/usage-stats";

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

const EVALUATION_INTERVAL_MS = 60_000; // 60 seconds

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
 * Fetches today's usage for a child (as a Map of package_name -> total_seconds)
 */
async function fetchTodayUsage(childId: string): Promise<Map<string, number>> {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("app_usage_daily")
    .select("package_name,total_seconds")
    .eq("child_id", childId)
    .eq("usage_date", todayStr);

  if (error) {
    console.error("[EnforcementManager] Failed to fetch today usage:", error);
    return new Map();
  }

  const usageMap = new Map<string, number>();
  for (const row of data ?? []) {
    usageMap.set(row.package_name, row.total_seconds);
  }

  return usageMap;
}

/**
 * Central manager for evaluating and enforcing screen time constraints.
 * Runs a periodic evaluation loop that:
 * 1. Fetches constraints, limits, overrides, and usage data
 * 2. Calculates which apps should be blocked
 * 3. Updates the native blocking service with the blocked list
 */
class ConstraintEnforcementManager {
  private childId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isEvaluating = false;
  private lastBlockedPackages: BlockedPackageWithReason[] = [];

  /**
   * Start the enforcement loop for a child
   */
  start(childId: string): void {
    if (this.childId === childId && this.intervalId !== null) {
      // Already running for this child
      return;
    }

    this.stop();
    this.childId = childId;

    console.log("[EnforcementManager] Starting for child:", childId);

    // Run immediately, then on interval
    this.evaluateNow();
    this.intervalId = setInterval(() => {
      this.evaluateNow();
    }, EVALUATION_INTERVAL_MS);
  }

  /**
   * Stop the enforcement loop
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.childId = null;
    this.isEvaluating = false;
    console.log("[EnforcementManager] Stopped");
  }

  /**
   * Trigger an immediate evaluation (e.g., after sync completes)
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
   * Get the last calculated blocked packages with reasons
   */
  getLastBlockedPackages(): BlockedPackageWithReason[] {
    return this.lastBlockedPackages;
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
    const [constraints, appLimits, overrides, usageToday, installedApps] =
      await Promise.all([
        fetchChildConstraints(childId),
        fetchAppLimits(childId),
        fetchActiveOverrides(childId),
        fetchTodayUsage(childId),
        fetchInstalledApps(),
      ]);

    // Get all package names from installed apps
    const allPackages = installedApps.map((app) => app.packageName);

    // Convert constraint types to match expected interface
    const timeRules = constraints.timeRules as ChildTimeRuleRow[];
    const usageSettings = constraints.usageSettings as ChildUsageSettingsRow | null;

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
  }
}

// Export singleton instance
export const constraintEnforcementManager = new ConstraintEnforcementManager();
