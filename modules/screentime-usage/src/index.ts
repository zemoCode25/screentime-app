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
