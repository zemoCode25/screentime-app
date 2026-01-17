import { Platform } from "react-native";
import {
  getAppIconBase64,
  getBlockedPackages,
  getBlockReason,
  getInstalledApps,
  getUsageStats,
  isAccessibilityEnabled,
  isUsageAccessGranted,
  isUsageModuleAvailable,
  openUsageAccessSettings,
  requestAccessibilityPermission,
  updateAppLimits,
  updateBlockedPackages,
  updateBlockedPackagesWithReasons,
  updateTimeRules,
  updateDailyLimit,
  type BlockedPackageWithReason,
  type TimeRule,
  type DailyLimitSettings,
} from "screentime-usage";

export type InstalledApp = {
  packageName: string;
  appName: string;
  category: string;
  isSystemApp: boolean;
};

export type UsageStat = {
  packageName: string;
  totalTimeMs: number;
  lastTimeUsed: number;
};

export type UsageAccessStatus = "granted" | "needs-permission" | "unavailable";

export function canUseUsageStats() {
  return Platform.OS === "android" && isUsageModuleAvailable();
}

export async function ensureUsageAccess(): Promise<UsageAccessStatus> {
  if (!canUseUsageStats()) {
    return "unavailable";
  }
  const granted = isUsageAccessGranted();
  if (granted) {
    return "granted";
  }
  openUsageAccessSettings();
  return "needs-permission";
}

export async function fetchInstalledApps(): Promise<InstalledApp[]> {
  if (!canUseUsageStats()) {
    return [];
  }
  return getInstalledApps();
}

export async function fetchUsageStats(
  startTimeMs: number,
  endTimeMs: number
): Promise<UsageStat[]> {
  if (!canUseUsageStats()) {
    return [];
  }
  return getUsageStats(startTimeMs, endTimeMs);
}

export type AccessibilityStatus =
  | "granted"
  | "needs-permission"
  | "unavailable";

export function canUseAccessibility() {
  return Platform.OS === "android" && isUsageModuleAvailable();
}

export function checkAccessibilityEnabled(): boolean {
  if (!canUseAccessibility()) {
    return false;
  }
  return isAccessibilityEnabled();
}

export async function ensureAccessibilityAccess(): Promise<AccessibilityStatus> {
  if (!canUseAccessibility()) {
    return "unavailable";
  }
  const enabled = isAccessibilityEnabled();
  if (enabled) {
    return "granted";
  }
  requestAccessibilityPermission();
  return "needs-permission";
}

export async function setBlockedPackages(packages: string[]): Promise<void> {
  if (!canUseAccessibility()) {
    return;
  }
  await updateBlockedPackages(packages);
}

export async function getBlockedPackagesList(): Promise<string[]> {
  if (!canUseAccessibility()) {
    return [];
  }
  return getBlockedPackages();
}

export async function fetchAppIconBase64(
  packageName: string
): Promise<string | null> {
  if (!canUseUsageStats()) {
    return null;
  }
  return getAppIconBase64(packageName);
}

export async function setBlockedPackagesWithReasons(
  packages: BlockedPackageWithReason[]
): Promise<void> {
  if (!canUseAccessibility()) {
    return;
  }
  await updateBlockedPackagesWithReasons(packages);
}

export async function fetchBlockReason(
  packageName: string
): Promise<string | null> {
  if (!canUseAccessibility()) {
    return null;
  }
  return getBlockReason(packageName);
}

/**
 * Sets total daily limits for apps.
 * The native accessibility service will query UsageStatsManager for real-time
 * usage and calculate accurate remaining time when each app is opened.
 * @param limits Map of packageName -> limitSeconds (total daily limit)
 */
export async function setAppLimits(
  limits: Record<string, number>
): Promise<void> {
  if (!canUseAccessibility()) {
    return;
  }
  await updateAppLimits(JSON.stringify(limits));
}

/**
 * Sets time rules (bedtime and focus time) in the native accessibility service.
 * The native service will check these rules directly when apps are opened,
 * ensuring enforcement works even when the JS side hasn't recalculated.
 * @param rules Array of time rules with ruleType, startSeconds, endSeconds, and days
 */
export async function setTimeRules(rules: TimeRule[]): Promise<void> {
  if (!canUseAccessibility()) {
    return;
  }
  await updateTimeRules(rules);
}

/**
 * Sets daily limit settings in the native accessibility service.
 * The native service will check total usage directly when apps are opened,
 * ensuring enforcement works even when the JS side hasn't recalculated.
 * @param settings Daily limit and weekend bonus settings
 */
export async function setDailyLimitSettings(
  settings: DailyLimitSettings
): Promise<void> {
  if (!canUseAccessibility()) {
    return;
  }
  await updateDailyLimit(settings);
}

// Re-export types for convenience
export type { TimeRule, DailyLimitSettings };
