import { requireOptionalNativeModule } from "expo-modules-core";

export type BlockedPackageWithReason = {
  packageName: string;
  reason: string;
};

export type TimeRule = {
  ruleType: "bedtime" | "focus";
  startSeconds: number;
  endSeconds: number;
  days: number[];
};

export type DailyLimitSettings = {
  limitSeconds: number;
  weekendBonusSeconds: number;
};

export type DndMode = "off" | "priority" | "total_silence" | "alarms_only" | "unknown";

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
  updateAppLimits: (limitsJson: string) => Promise<void>;
  updateTimeRules: (rulesJson: string) => Promise<void>;
  updateDailyLimit: (settingsJson: string) => Promise<void>;
  // DND mode functions
  isDndAccessGranted: () => boolean;
  requestDndAccess: () => void;
  setDndMode: (enabled: boolean) => Promise<boolean>;
  getDndMode: () => DndMode;
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

export function updateAppLimits(limitsJson: string) {
  return UsageStatsModule?.updateAppLimits?.(limitsJson) ?? Promise.resolve();
}

export function updateTimeRules(rules: TimeRule[]) {
  const rulesJson = JSON.stringify(rules);
  return UsageStatsModule?.updateTimeRules?.(rulesJson) ?? Promise.resolve();
}

export function updateDailyLimit(settings: DailyLimitSettings) {
  const settingsJson = JSON.stringify(settings);
  return UsageStatsModule?.updateDailyLimit?.(settingsJson) ?? Promise.resolve();
}

// Do Not Disturb (DND) mode functions

export function isDndAccessGranted() {
  return UsageStatsModule?.isDndAccessGranted?.() ?? false;
}

export function requestDndAccess() {
  UsageStatsModule?.requestDndAccess?.();
}

export function setDndMode(enabled: boolean) {
  return UsageStatsModule?.setDndMode?.(enabled) ?? Promise.resolve(false);
}

export function getDndMode(): DndMode {
  return UsageStatsModule?.getDndMode?.() ?? "unknown";
}
