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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchChildrenWithUsageSummary(): Promise<
  ChildListItem[]
> {
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
    const entry = summaryByChild.get(row.child_id) ?? {
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
    .select(
      "id,app_name,category,package_name,icon_path,icon_url,child_id,created_at"
    )
    .eq("child_id", childId)
    .order("app_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchChildUsageSummary(
  childId: string,
  windowDays: number = CHILD_USAGE_WINDOW_DAYS
): Promise<ChildUsageSummary> {
  const resolvedWindowDays = Math.max(1, windowDays);
  const startDate = getDateDaysAgo(resolvedWindowDays - 1);

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
    avgDailySeconds: totalSeconds / resolvedWindowDays,
    activeDays: activeDays.size,
    mostUsedPackage,
  };
}

export type AppUsageDetail = {
  packageName: string;
  totalSeconds: number;
  openCount: number;
};

export async function fetchChildAppUsageDetails(
  childId: string,
  windowDays: number = CHILD_USAGE_WINDOW_DAYS
): Promise<AppUsageDetail[]> {
  const resolvedWindowDays = Math.max(1, windowDays);
  const startDate = getDateDaysAgo(resolvedWindowDays - 1);

  const { data: usageRows, error } = await supabase
    .from("app_usage_daily")
    .select("package_name,total_seconds,open_count")
    .eq("child_id", childId)
    .gte("usage_date", startDate);

  if (error) {
    throw new Error(error.message);
  }

  const packageMap = new Map<
    string,
    { totalSeconds: number; openCount: number }
  >();

  for (const row of usageRows ?? []) {
    const entry = packageMap.get(row.package_name) ?? {
      totalSeconds: 0,
      openCount: 0,
    };
    entry.totalSeconds += row.total_seconds ?? 0;
    entry.openCount += row.open_count ?? 0;
    packageMap.set(row.package_name, entry);
  }

  return Array.from(packageMap.entries()).map(([packageName, data]) => ({
    packageName,
    totalSeconds: data.totalSeconds,
    openCount: data.openCount,
  }));
}

export type AppDailyUsage = {
  usageDate: string;
  totalSeconds: number;
  openCount: number;
};

export type AppHourlyUsage = {
  usageDate: string;
  hour: number;
  totalSeconds: number;
};

export type AppDetailedUsage = {
  appName: string;
  category: string;
  packageName: string;
  totalSeconds: number;
  totalOpenCount: number;
  avgDailySeconds: number;
  activeDays: number;
  dailyUsage: AppDailyUsage[];
  hourlyUsage: AppHourlyUsage[];
};

export async function fetchChildAppDetailedUsage(
  childId: string,
  packageName: string,
  windowDays: number = CHILD_USAGE_WINDOW_DAYS
): Promise<AppDetailedUsage> {
  const resolvedWindowDays = Math.max(1, windowDays);
  const startDate = getDateDaysAgo(resolvedWindowDays - 1);

  // Fetch app info
  const { data: appData, error: appError } = await supabase
    .from("child_apps")
    .select("app_name,category,package_name")
    .eq("child_id", childId)
    .eq("package_name", packageName)
    .maybeSingle();

  if (appError) {
    throw new Error(appError.message);
  }

  const appName = appData?.app_name ?? packageName;
  const category = appData?.category ?? "other";

  // Fetch daily usage
  const { data: dailyRows, error: dailyError } = await supabase
    .from("app_usage_daily")
    .select("usage_date,total_seconds,open_count")
    .eq("child_id", childId)
    .eq("package_name", packageName)
    .gte("usage_date", startDate)
    .order("usage_date", { ascending: true });

  if (dailyError) {
    throw new Error(dailyError.message);
  }

  // Fetch hourly usage
  const { data: hourlyRows, error: hourlyError } = await supabase
    .from("app_usage_hourly")
    .select("usage_date,hour,total_seconds")
    .eq("child_id", childId)
    .eq("package_name", packageName)
    .gte("usage_date", startDate)
    .order("usage_date", { ascending: true });

  if (hourlyError) {
    throw new Error(hourlyError.message);
  }

  const dailyUsage: AppDailyUsage[] = (dailyRows ?? []).map((row) => ({
    usageDate: row.usage_date,
    totalSeconds: row.total_seconds ?? 0,
    openCount: row.open_count ?? 0,
  }));

  const hourlyUsage: AppHourlyUsage[] = (hourlyRows ?? []).map((row) => ({
    usageDate: row.usage_date,
    hour: row.hour ?? 0,
    totalSeconds: row.total_seconds ?? 0,
  }));

  let totalSeconds = 0;
  let totalOpenCount = 0;
  const activeDaysSet = new Set<string>();

  for (const row of dailyUsage) {
    totalSeconds += row.totalSeconds;
    totalOpenCount += row.openCount;
    if (row.totalSeconds > 0) {
      activeDaysSet.add(row.usageDate);
    }
  }

  return {
    appName,
    category,
    packageName,
    totalSeconds,
    totalOpenCount,
    avgDailySeconds: totalSeconds / resolvedWindowDays,
    activeDays: activeDaysSet.size,
    dailyUsage,
    hourlyUsage,
  };
}
