import type { Database } from "@/types/database-types";

type AppLimit = Database["public"]["Tables"]["app_limits"]["Row"];
type AppAccessOverride =
  Database["public"]["Tables"]["app_access_overrides"]["Row"];

export type BlockedAppInfo = {
  packageName: string;
  limitSeconds: number;
  usedSeconds: number;
  reason: "limit_exceeded";
};

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
    if (!limit.applies_to_days?.includes(dayOfWeek)) {
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
    if (!limit.applies_to_days?.includes(dayOfWeek)) {
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
  if (!limit.applies_to_days?.includes(dayOfWeek)) {
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

  if (!limit.applies_to_days?.includes(dayOfWeek)) {
    return null;
  }

  const usedSeconds = usageToday.get(packageName) ?? 0;
  const remaining = limit.limit_seconds - usedSeconds;

  return remaining;
}
