import type { Database } from "@/types/database-types";

import {
  getActiveConstraintType,
  isDailyLimitExceeded,
  isWithinBedtime,
  isWithinFocusTime,
  SYSTEM_ALLOWLIST,
} from "./constraint-utils";

type AppLimit = Database["public"]["Tables"]["app_limits"]["Row"];
type AppAccessOverride =
  Database["public"]["Tables"]["app_access_overrides"]["Row"];
type ChildTimeRule = Database["public"]["Tables"]["child_time_rules"]["Row"];
type ChildUsageSettings =
  Database["public"]["Tables"]["child_usage_settings"]["Row"];

export type BlockReason = "bedtime" | "focus" | "daily_limit" | "app_limit";

export type BlockedAppInfo = {
  packageName: string;
  limitSeconds: number;
  usedSeconds: number;
  reason: "limit_exceeded";
};

export type BlockedPackageWithReason = {
  packageName: string;
  reason: BlockReason;
};

/**
 * Converts app_limits applies_* fields to a day-of-week array
 */
function getLimitApplicableDays(limit: AppLimit): number[] {
  const days: number[] = [];
  if (limit.applies_sun) days.push(0);
  if (limit.applies_mon) days.push(1);
  if (limit.applies_tue) days.push(2);
  if (limit.applies_wed) days.push(3);
  if (limit.applies_thu) days.push(4);
  if (limit.applies_fri) days.push(5);
  if (limit.applies_sat) days.push(6);
  return days;
}

/**
 * Determines which apps should be blocked based on:
 * - App limits set by parent
 * - Current usage for today
 * - Active overrides granted by parent
 * - Day of week applicability
 */
export function calculateBlockedPackages(
  limits: AppLimit[],
  usageToday: Map<string, number>, // package_name -> total_seconds today
  overrides: AppAccessOverride[]
): string[] {
  const blocked: string[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  for (const limit of limits) {
    // Check if limit applies to today
    const applicableDays = getLimitApplicableDays(limit);
    if (!applicableDays.includes(dayOfWeek)) {
      continue;
    }

    const usedSeconds = usageToday.get(limit.package_name) ?? 0;

    // Check if limit is exceeded
    if (usedSeconds < limit.limit_seconds) {
      continue;
    }

    // Check if there's an active override
    const hasOverride = overrides.some(
      (override) =>
        override.package_name === limit.package_name &&
        override.status === "active" &&
        new Date(override.expires_at) > now
    );

    if (hasOverride) {
      continue;
    }

    // No override and limit exceeded -> block the app
    blocked.push(limit.package_name);
  }

  return blocked;
}

/**
 * Gets detailed information about blocked apps
 */
export function getBlockedAppsInfo(
  limits: AppLimit[],
  usageToday: Map<string, number>,
  overrides: AppAccessOverride[]
): BlockedAppInfo[] {
  const blocked: BlockedAppInfo[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay();

  for (const limit of limits) {
    const applicableDays = getLimitApplicableDays(limit);
    if (!applicableDays.includes(dayOfWeek)) {
      continue;
    }

    const usedSeconds = usageToday.get(limit.package_name) ?? 0;

    if (usedSeconds < limit.limit_seconds) {
      continue;
    }

    const hasOverride = overrides.some(
      (override) =>
        override.package_name === limit.package_name &&
        override.status === "active" &&
        new Date(override.expires_at) > now
    );

    if (hasOverride) {
      continue;
    }

    blocked.push({
      packageName: limit.package_name,
      limitSeconds: limit.limit_seconds,
      usedSeconds,
      reason: "limit_exceeded",
    });
  }

  return blocked;
}

/**
 * Checks if a specific app is currently blocked
 */
export function isAppBlocked(
  packageName: string,
  limits: AppLimit[],
  usageToday: Map<string, number>,
  overrides: AppAccessOverride[]
): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const limit = limits.find((l) => l.package_name === packageName);

  if (!limit) {
    return false;
  }

  // Check if limit applies to today
  const applicableDays = getLimitApplicableDays(limit);
  if (!applicableDays.includes(dayOfWeek)) {
    return false;
  }

  const usedSeconds = usageToday.get(packageName) ?? 0;

  // Check if limit is exceeded
  if (usedSeconds < limit.limit_seconds) {
    return false;
  }

  // Check if there's an active override
  const hasOverride = overrides.some(
    (override) =>
      override.package_name === packageName &&
      override.status === "active" &&
      new Date(override.expires_at) > now
  );

  return !hasOverride;
}

/**
 * Gets time remaining (in seconds) before an app gets blocked.
 * Returns null if app has no limit or limit doesn't apply today.
 * Returns 0 if limit is already exceeded (but might have override).
 * Returns negative number if already blocked.
 */
export function getTimeRemaining(
  packageName: string,
  limits: AppLimit[],
  usageToday: Map<string, number>
): number | null {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const limit = limits.find((l) => l.package_name === packageName);

  if (!limit) {
    return null;
  }

  const applicableDays = getLimitApplicableDays(limit);
  if (!applicableDays.includes(dayOfWeek)) {
    return null;
  }

  const usedSeconds = usageToday.get(packageName) ?? 0;
  const remaining = limit.limit_seconds - usedSeconds;

  return remaining;
}

/**
 * Calculates all blocked packages with their block reasons.
 * This is the main enforcement function that checks:
 * 1. Bedtime rules - if active, block ALL apps except allowlist
 * 2. Focus time rules - if active, block ALL apps except allowlist
 * 3. Global daily limit - if exceeded, block ALL apps except allowlist
 * 4. Per-app limits (existing logic) - block specific apps
 *
 * @param appLimits - Per-app daily limits from parent
 * @param usageToday - Map of package_name -> total_seconds for today
 * @param overrides - Active access overrides from parent
 * @param timeRules - Bedtime and focus time rules
 * @param usageSettings - Global daily limit and weekend bonus settings
 * @param allPackages - All installed app package names on the device
 * @param now - Current date/time (optional, for testing)
 */
export function calculateAllBlockedPackages(
  appLimits: AppLimit[],
  usageToday: Map<string, number>,
  overrides: AppAccessOverride[],
  timeRules: ChildTimeRule[],
  usageSettings: ChildUsageSettings | null,
  allPackages: string[],
  now: Date = new Date()
): BlockedPackageWithReason[] {
  const blocked: BlockedPackageWithReason[] = [];
  const dayOfWeek = now.getDay();

  // Filter out system apps that should never be blocked
  const blockablePackages = allPackages.filter(
    (pkg) => !SYSTEM_ALLOWLIST.includes(pkg)
  );

  // Check global constraints first (bedtime, focus, daily limit)
  // These block ALL apps except system allowlist

  // 1. Bedtime check - highest priority
  if (isWithinBedtime(timeRules, now)) {
    for (const packageName of blockablePackages) {
      blocked.push({ packageName, reason: "bedtime" });
    }
    return blocked;
  }

  // 2. Focus time check
  if (isWithinFocusTime(timeRules, now)) {
    for (const packageName of blockablePackages) {
      blocked.push({ packageName, reason: "focus" });
    }
    return blocked;
  }

  // 3. Global daily limit check
  if (isDailyLimitExceeded(usageSettings, usageToday, now)) {
    for (const packageName of blockablePackages) {
      blocked.push({ packageName, reason: "daily_limit" });
    }
    return blocked;
  }

  // 4. Per-app limit checks (existing logic)
  for (const limit of appLimits) {
    const limitApplicableDays = getLimitApplicableDays(limit);

    // Check if limit applies to today
    if (!limitApplicableDays.includes(dayOfWeek)) {
      continue;
    }

    const usedSeconds = usageToday.get(limit.package_name) ?? 0;

    // Check if limit is exceeded
    if (usedSeconds < limit.limit_seconds) {
      continue;
    }

    // Check if there's an active override
    const hasOverride = overrides.some(
      (override) =>
        override.package_name === limit.package_name &&
        override.status === "active" &&
        new Date(override.expires_at) > now
    );

    if (hasOverride) {
      continue;
    }

    // No override and limit exceeded -> block the app
    blocked.push({ packageName: limit.package_name, reason: "app_limit" });
  }

  return blocked;
}

/**
 * Gets the block reason for a specific package from a list of blocked packages
 */
export function getBlockReasonForPackage(
  packageName: string,
  blockedPackages: BlockedPackageWithReason[]
): BlockReason | null {
  const entry = blockedPackages.find((bp) => bp.packageName === packageName);
  return entry?.reason ?? null;
}
