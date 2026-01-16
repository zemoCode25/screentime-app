import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type ChildRow = Database["public"]["Tables"]["children"]["Row"];
type ChildInsert = Database["public"]["Tables"]["children"]["Insert"];
type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];

export type ChildListItem = ChildRow & {
  avgDailySeconds: number;
  totalSeconds: number;
  activeDays: number;
};

export type ChildUsageSummary = {
  totalSeconds: number;
  avgDailySeconds: number;
  activeDays: number;
  mostUsedPackage: string | null;
};

export const CHILD_USAGE_WINDOW_DAYS = 30;

const CHILD_SELECT_FIELDS =
  "id,name,age,grade_level,interests,motivations,created_at,parent_user_id,child_user_id,child_email";

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function fetchChildrenWithUsageSummary(): Promise<ChildListItem[]> {
  const { data: children, error } = await supabase
    .from("children")
    .select(CHILD_SELECT_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  if (!children || children.length === 0) {
    return [];
  }

  const childIds = children.map((child) => child.id);
  const startDate = getDateDaysAgo(CHILD_USAGE_WINDOW_DAYS);

  const { data: usageRows, error: usageError } = await supabase
    .from("app_usage_daily")
    .select("child_id,total_seconds,usage_date")
    .in("child_id", childIds)
    .gte("usage_date", startDate);

  if (usageError) {
    throw new Error(usageError.message);
  }

  const summaryByChild = new Map<
    string,
    { totalSeconds: number; activeDays: Set<string> }
  >();

  for (const row of usageRows ?? []) {
    const entry =
      summaryByChild.get(row.child_id) ?? {
        totalSeconds: 0,
        activeDays: new Set<string>(),
      };
    entry.totalSeconds += row.total_seconds ?? 0;
    entry.activeDays.add(row.usage_date);
    summaryByChild.set(row.child_id, entry);
  }

  return children.map((child) => {
    const summary = summaryByChild.get(child.id);
    const totalSeconds = summary?.totalSeconds ?? 0;
    const activeDays = summary?.activeDays.size ?? 0;
    const avgDailySeconds = totalSeconds / CHILD_USAGE_WINDOW_DAYS;

    return {
      ...child,
      totalSeconds,
      avgDailySeconds,
      activeDays,
    };
  });
}

export async function createChild(payload: ChildInsert): Promise<ChildRow> {
  const { data, error } = await supabase
    .from("children")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function fetchChildById(childId: string): Promise<ChildRow> {
  const { data, error } = await supabase
    .from("children")
    .select(CHILD_SELECT_FIELDS)
    .eq("id", childId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Child not found.");
  }

  return data;
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

export async function fetchChildUsageSummary(
  childId: string
): Promise<ChildUsageSummary> {
  const startDate = getDateDaysAgo(CHILD_USAGE_WINDOW_DAYS);

  const { data: usageRows, error } = await supabase
    .from("app_usage_daily")
    .select("package_name,total_seconds,usage_date")
    .eq("child_id", childId)
    .gte("usage_date", startDate);

  if (error) {
    throw new Error(error.message);
  }

  let totalSeconds = 0;
  const activeDays = new Set<string>();
  const packageTotals = new Map<string, number>();

  for (const row of usageRows ?? []) {
    totalSeconds += row.total_seconds ?? 0;
    activeDays.add(row.usage_date);

    const currentTotal = packageTotals.get(row.package_name) ?? 0;
    packageTotals.set(
      row.package_name,
      currentTotal + (row.total_seconds ?? 0)
    );
  }

  let mostUsedPackage: string | null = null;
  let highestSeconds = 0;

  for (const [packageName, seconds] of packageTotals.entries()) {
    if (seconds > highestSeconds) {
      highestSeconds = seconds;
      mostUsedPackage = packageName;
    }
  }

  return {
    totalSeconds,
    avgDailySeconds: totalSeconds / CHILD_USAGE_WINDOW_DAYS,
    activeDays: activeDays.size,
    mostUsedPackage,
  };
}
