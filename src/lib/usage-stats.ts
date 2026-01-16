import { Platform } from "react-native";
import {
  getAppIconBase64,
  getBlockedPackages,
  getInstalledApps,
  getUsageStats,
  isAccessibilityEnabled,
  isUsageAccessGranted,
  isUsageModuleAvailable,
  openUsageAccessSettings,
  requestAccessibilityPermission,
  updateBlockedPackages,
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
