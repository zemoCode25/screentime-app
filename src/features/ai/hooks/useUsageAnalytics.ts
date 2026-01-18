import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  ChildContextForAI,
  UsageDataForAI,
} from "@/src/features/ai/types/ai-responses";

const DEFAULT_ANALYSIS_DAYS = 14;

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type UsageAnalyticsData = {
  childContext: ChildContextForAI;
  usageData: UsageDataForAI[];
};

async function fetchUsageAnalytics(
  childId: string,
  analysisDays: number
): Promise<UsageAnalyticsData> {
  try {
    // Fetch child info
    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id,age,created_at")
      .eq("id", childId)
      .single();

    if (childError || !child) {
      throw new Error(childError?.message ?? "Child not found");
    }

    const startDate = getDateDaysAgo(analysisDays - 1);

    // Fetch app metadata
    const { data: apps, error: appsError } = await supabase
      .from("child_apps")
      .select("package_name,app_name,category")
      .eq("child_id", childId);

    if (appsError) {
      throw new Error(appsError.message);
    }

    // Fetch daily usage
    const { data: usageRows, error: usageError } = await supabase
      .from("app_usage_daily")
      .select("package_name,usage_date,total_seconds")
      .eq("child_id", childId)
      .gte("usage_date", startDate)
      .order("usage_date", { ascending: true });

    if (usageError) {
      throw new Error(usageError.message);
    }

    // Fetch current limits
    const { data: limits, error: limitsError } = await supabase
      .from("app_limits")
      .select("package_name,limit_seconds")
      .eq("child_id", childId);

    if (limitsError) {
      throw new Error(limitsError.message);
    }

    // Build app metadata lookup
    const appMetadata = new Map<string, { appName: string; category: string }>();
    for (const app of apps ?? []) {
      appMetadata.set(app.package_name, {
        appName: app.app_name,
        category: app.category,
      });
    }

    // Build limits lookup
    const limitsMap = new Map<string, number>();
    for (const limit of limits ?? []) {
      limitsMap.set(limit.package_name, Math.round(limit.limit_seconds / 60));
    }

    // Aggregate usage by app and date
    const usageByApp = new Map<string, Map<string, number>>();

    for (const row of usageRows ?? []) {
      if (!usageByApp.has(row.package_name)) {
        usageByApp.set(row.package_name, new Map());
      }
      const appDates = usageByApp.get(row.package_name)!;
      const minutes = Math.round((row.total_seconds ?? 0) / 60);
      appDates.set(
        row.usage_date,
        (appDates.get(row.usage_date) ?? 0) + minutes,
      );
    }

    // Generate all dates in the range
    const allDates: string[] = [];
    for (let i = analysisDays - 1; i >= 0; i--) {
      allDates.push(getDateDaysAgo(i));
    }

    // Build usage data for AI
    const usageData: UsageDataForAI[] = [];

    for (const [packageName, dateUsage] of usageByApp.entries()) {
      const dailyUsageMinutes = allDates.map(
        (date) => dateUsage.get(date) ?? 0,
      );
      const totalMinutes = dailyUsageMinutes.reduce((sum, m) => sum + m, 0);
      const averageMinutes = totalMinutes / analysisDays;

      const metadata = appMetadata.get(packageName);

      usageData.push({
        packageName,
        appName: metadata?.appName ?? packageName,
        category: metadata?.category ?? "other",
        dailyUsageMinutes,
        averageMinutes: Math.round(averageMinutes * 10) / 10,
        currentLimitMinutes: limitsMap.get(packageName) ?? null,
      });
    }

    // Sort by average usage (highest first)
    usageData.sort((a, b) => b.averageMinutes - a.averageMinutes);

    const childContext: ChildContextForAI = {
      age: child.age,
      accountCreatedAt: child.created_at,
      daysAnalyzed: analysisDays,
    };

    return { childContext, usageData };
  } catch (error) {
    if (__DEV__) {
      console.error("Failed to fetch usage analytics", {
        childId,
        analysisDays,
        error,
      });
    }
    throw error;
  }
}

export function useUsageAnalytics(
  childId?: string,
  analysisDays: number = DEFAULT_ANALYSIS_DAYS
) {
  return useQuery({
    queryKey: ["ai", "usage-analytics", childId, analysisDays],
    queryFn: () => fetchUsageAnalytics(childId!, analysisDays),
    enabled: Boolean(childId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
