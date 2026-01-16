import type { Database } from "@/types/database-types";

type ChildTimeRule = Database["public"]["Tables"]["child_time_rules"]["Row"];
type ChildUsageSettings =
  Database["public"]["Tables"]["child_usage_settings"]["Row"];

/**
 * System apps that should never be blocked
 */
export const SYSTEM_ALLOWLIST = [
  "com.android.settings",
  "com.android.dialer",
  "com.android.phone",
  "com.android.systemui",
  "com.android.emergency",
  "com.google.android.dialer",
  "com.samsung.android.dialer",
  "com.welltime.app", // This app
];

/**
 * Converts a Date to seconds since midnight
 */
export function dateToSecondsSinceMidnight(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/**
 * Check if today is a weekend (Saturday = 6, Sunday = 0)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Check if a single bedtime rule is currently active.
 * Handles midnight crossover (e.g., 22:00-07:00).
 *
 * For rules that cross midnight:
 * - The rule is active if current time is after start on a day in the days array
 * - OR if current time is before end and YESTERDAY was in the days array
 */
function isBedtimeRuleActive(rule: ChildTimeRule, now: Date): boolean {
  const dayOfWeek = now.getDay();
  const nowSeconds = dateToSecondsSinceMidnight(now);
  const crossesMidnight = rule.end_seconds < rule.start_seconds;

  if (crossesMidnight) {
    // Check if we're in the "before midnight" portion (same day as rule start)
    if (nowSeconds >= rule.start_seconds && rule.days.includes(dayOfWeek)) {
      return true;
    }
    // Check if we're in the "after midnight" portion (day after rule start)
    // Yesterday's day of week
    const yesterdayDow = (dayOfWeek + 6) % 7;
    if (nowSeconds < rule.end_seconds && rule.days.includes(yesterdayDow)) {
      return true;
    }
    return false;
  }

  // Same-day window (doesn't cross midnight)
  return (
    rule.days.includes(dayOfWeek) &&
    nowSeconds >= rule.start_seconds &&
    nowSeconds < rule.end_seconds
  );
}

/**
 * Check if any bedtime rule is currently active
 */
export function isWithinBedtime(
  rules: ChildTimeRule[],
  now: Date = new Date()
): boolean {
  const bedtimeRules = rules.filter((rule) => rule.rule_type === "bedtime");
  return bedtimeRules.some((rule) => isBedtimeRuleActive(rule, now));
}

/**
 * Check if a single focus time rule is currently active.
 * Focus time rules only apply to weekdays (Mon-Fri, days 1-5).
 */
function isFocusRuleActive(rule: ChildTimeRule, now: Date): boolean {
  const dayOfWeek = now.getDay();
  const nowSeconds = dateToSecondsSinceMidnight(now);

  // Focus time only applies to weekdays
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if rule applies to today and current time is within range
  return (
    rule.days.includes(dayOfWeek) &&
    nowSeconds >= rule.start_seconds &&
    nowSeconds < rule.end_seconds
  );
}

/**
 * Check if any focus time rule is currently active
 */
export function isWithinFocusTime(
  rules: ChildTimeRule[],
  now: Date = new Date()
): boolean {
  const focusRules = rules.filter((rule) => rule.rule_type === "focus");
  return focusRules.some((rule) => isFocusRuleActive(rule, now));
}

/**
 * Get the effective daily limit in seconds, including weekend bonus if applicable.
 * Returns null if no usage settings are configured (no limit).
 */
export function getEffectiveDailyLimit(
  settings: ChildUsageSettings | null,
  date: Date = new Date()
): number | null {
  if (!settings) {
    return null; // No limit configured
  }

  // If daily limit is 0, treat as no limit
  if (settings.daily_limit_seconds === 0) {
    return null;
  }

  const bonus = isWeekend(date) ? settings.weekend_bonus_seconds : 0;
  return settings.daily_limit_seconds + bonus;
}

/**
 * Calculate total usage for today from a usage map
 */
export function calculateTotalUsage(
  usageToday: Map<string, number>,
  excludePackages: string[] = SYSTEM_ALLOWLIST
): number {
  let total = 0;
  for (const [packageName, seconds] of usageToday) {
    if (!excludePackages.includes(packageName)) {
      total += seconds;
    }
  }
  return total;
}

/**
 * Check if daily limit is exceeded
 */
export function isDailyLimitExceeded(
  settings: ChildUsageSettings | null,
  usageToday: Map<string, number>,
  now: Date = new Date()
): boolean {
  const limit = getEffectiveDailyLimit(settings, now);
  if (limit === null) {
    return false; // No limit configured
  }

  const totalUsage = calculateTotalUsage(usageToday);
  return totalUsage >= limit;
}

/**
 * Get remaining daily time in seconds.
 * Returns null if no limit is configured.
 * Returns 0 if limit is exceeded.
 */
export function getDailyTimeRemaining(
  settings: ChildUsageSettings | null,
  usageToday: Map<string, number>,
  now: Date = new Date()
): number | null {
  const limit = getEffectiveDailyLimit(settings, now);
  if (limit === null) {
    return null;
  }

  const totalUsage = calculateTotalUsage(usageToday);
  return Math.max(0, limit - totalUsage);
}

/**
 * Get the currently active constraint type, if any.
 * Priority: bedtime > focus > daily_limit > none
 */
export function getActiveConstraintType(
  rules: ChildTimeRule[],
  settings: ChildUsageSettings | null,
  usageToday: Map<string, number>,
  now: Date = new Date()
): "bedtime" | "focus" | "daily_limit" | null {
  if (isWithinBedtime(rules, now)) {
    return "bedtime";
  }

  if (isWithinFocusTime(rules, now)) {
    return "focus";
  }

  if (isDailyLimitExceeded(settings, usageToday, now)) {
    return "daily_limit";
  }

  return null;
}
