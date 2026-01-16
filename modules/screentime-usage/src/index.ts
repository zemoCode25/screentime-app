import { requireOptionalNativeModule } from "expo-modules-core";

type UsageStatsModuleType = {
  isUsageAccessGranted: () => boolean;
  openUsageAccessSettings: () => void;
  getInstalledApps: () => Promise<
    {
      packageName: string;
      appName: string;
      category: string;
      isSystemApp: boolean;
    }[]
  >;
  getUsageStats: (
    startTimeMs: number,
    endTimeMs: number
  ) => Promise<
    {
      packageName: string;
      totalTimeMs: number;
      lastTimeUsed: number;
    }[]
  >;
  isAccessibilityEnabled: () => boolean;
  requestAccessibilityPermission: () => void;
  updateBlockedPackages: (packages: string[]) => Promise<void>;
  getBlockedPackages: () => Promise<string[]>;
};

const UsageStatsModule =
  requireOptionalNativeModule<UsageStatsModuleType>("UsageStatsModule");

export function isUsageModuleAvailable() {
  return Boolean(UsageStatsModule);
}

export function isUsageAccessGranted() {
  return UsageStatsModule?.isUsageAccessGranted?.() ?? false;
}

export function openUsageAccessSettings() {
  UsageStatsModule?.openUsageAccessSettings?.();
}

export function getInstalledApps() {
  return UsageStatsModule?.getInstalledApps?.() ?? Promise.resolve([]);
}

export function getUsageStats(startTimeMs: number, endTimeMs: number) {
  return (
    UsageStatsModule?.getUsageStats?.(startTimeMs, endTimeMs) ??
    Promise.resolve([])
  );
}

export function isAccessibilityEnabled() {
  return UsageStatsModule?.isAccessibilityEnabled?.() ?? false;
}

export function requestAccessibilityPermission() {
  UsageStatsModule?.requestAccessibilityPermission?.();
}

export function updateBlockedPackages(packages: string[]) {
  return UsageStatsModule?.updateBlockedPackages?.(packages) ?? Promise.resolve();
}

export function getBlockedPackages() {
  return UsageStatsModule?.getBlockedPackages?.() ?? Promise.resolve([]);
}
