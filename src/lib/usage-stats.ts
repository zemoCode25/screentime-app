import { Platform } from "react-native";
import {
  getInstalledApps,
  getUsageStats,
  isUsageAccessGranted,
  isUsageModuleAvailable,
  openUsageAccessSettings,
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

export type UsageAccessStatus =
  | "granted"
  | "needs-permission"
  | "unavailable";

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
