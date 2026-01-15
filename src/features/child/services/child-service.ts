import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type ChildRow = Database["public"]["Tables"]["children"]["Row"];
type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];
type AppUsageRow = Database["public"]["Tables"]["app_usage_daily"]["Row"];
type AppUsageHourlyRow =
  Database["public"]["Tables"]["app_usage_hourly"]["Row"];
type AppLimitRow = Database["public"]["Tables"]["app_limits"]["Row"];

const CHILD_SELECT_FIELDS =
  "id,name,age,grade_level,interests,motivations,child_user_id,child_email,parent_user_id";

const normalizeEmail = (email?: string | null) =>
  typeof email === "string" && email.trim().length > 0
    ? email.trim().toLowerCase()
    : null;

export async function fetchChildForUser(
  userId: string,
  email?: string | null
): Promise<ChildRow> {
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_SELECT_FIELDS)
    .eq("child_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const { data: emailMatch, error: emailError } = await supabase
      .from("children")
      .select(CHILD_SELECT_FIELDS)
      .eq("child_email", normalizedEmail)
      .maybeSingle();

    if (emailError) {
      throw new Error(emailError.message);
    }

    if (emailMatch) {
      return emailMatch;
    }
  }

  throw new Error("Child profile not found.");
}

export async function fetchChildApps(childId: string): Promise<ChildAppRow[]> {
  const { data, error } = await supabase
    .from("child_apps")
    .select("id,app_name,category,package_name,icon_path")
    .eq("child_id", childId)
    .order("app_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchChildUsageDaily(
  childId: string,
  startDate: string
): Promise<AppUsageRow[]> {
  const { data, error } = await supabase
    .from("app_usage_daily")
    .select("package_name,total_seconds,open_count,usage_date")
    .eq("child_id", childId)
    .gte("usage_date", startDate)
    .order("usage_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchChildUsageHourly(
  childId: string,
  startDate: string
): Promise<AppUsageHourlyRow[]> {
  const { data, error } = await supabase
    .from("app_usage_hourly")
    .select("package_name,total_seconds,usage_date,hour")
    .eq("child_id", childId)
    .gte("usage_date", startDate)
    .order("usage_date", { ascending: false })
    .order("hour", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchChildLimits(childId: string): Promise<AppLimitRow[]> {
  const { data, error } = await supabase
    .from("app_limits")
    .select(
      "id,package_name,limit_seconds,bonus_enabled,bonus_seconds,bonus_streak_target,applies_sun,applies_mon,applies_tue,applies_wed,applies_thu,applies_fri,applies_sat"
    )
    .eq("child_id", childId)
    .order("package_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
