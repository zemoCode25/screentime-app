import { requireOptionalNativeModule } from "expo-modules-core";

export type BlockedPackageWithReason = {
  packageName: string;
  reason: string;
};

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
  updateBlockedPackagesWithReasons: (
    packages: BlockedPackageWithReason[]
  ) => Promise<void>;
  getBlockedPackages: () => Promise<string[]>;
  getBlockReason: (packageName: string) => Promise<string | null>;
  getAppIconBase64: (packageName: string) => Promise<string | null>;
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
  return (
    UsageStatsModule?.updateBlockedPackages?.(packages) ?? Promise.resolve()
  );
}

export function getBlockedPackages() {
  return UsageStatsModule?.getBlockedPackages?.() ?? Promise.resolve([]);
}

export function getAppIconBase64(packageName: string) {
  return (
    UsageStatsModule?.getAppIconBase64?.(packageName) ?? Promise.resolve(null)
  );
}

export function updateBlockedPackagesWithReasons(
  packages: BlockedPackageWithReason[]
) {
  return (
    UsageStatsModule?.updateBlockedPackagesWithReasons?.(packages) ??
    Promise.resolve()
  );
}

export function getBlockReason(packageName: string) {
  return (
    UsageStatsModule?.getBlockReason?.(packageName) ?? Promise.resolve(null)
  );
}
