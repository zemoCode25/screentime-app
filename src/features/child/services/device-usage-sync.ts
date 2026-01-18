import Constants from "expo-constants";

import { supabase } from "@/lib/supabase";
import { syncAppIconsForTopApps } from "@/src/features/child/services/icon-sync-service";
import {
  canUseUsageStats,
  ensureUsageAccess,
  fetchInstalledApps,
  fetchUsageStats,
  type UsageAccessStatus,
} from "@/src/lib/usage-stats";
import { resolveAppCategory } from "@/src/utils/app-category";
import type { Database } from "@/types/database-types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SyncSummary = {
  appsSynced: number;
  usageRows: number;
  iconsSynced: number;
  accessStatus: UsageAccessStatus;
};

const getDeviceId = () => {
  const name = Constants.deviceName?.trim();
  if (name) {
    return `device:${name}`;
  }
  return "device:android";
};

const getIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
};

export async function syncChildDeviceUsage(
  childId: string,
  days: number
): Promise<SyncSummary> {
  if (!canUseUsageStats()) {
    return {
      appsSynced: 0,
      usageRows: 0,
      iconsSynced: 0,
      accessStatus: "unavailable",
    };
  }

  const accessStatus = await ensureUsageAccess();
  if (accessStatus !== "granted") {
    return { appsSynced: 0, usageRows: 0, iconsSynced: 0, accessStatus };
  }

  const installedApps = await fetchInstalledApps();

  const now = new Date();
  const deviceId = getDeviceId();
  const usageByKey = new Map<
    string,
    Database["public"]["Tables"]["app_usage_daily"]["Insert"]
  >();
  const packagesWithUsage = new Set<string>();
  const usageByPackage = new Map<string, number>();

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const day = new Date(now.getTime() - dayOffset * MS_PER_DAY);
    const { start, end } = getDayRange(day);
    const usageDate = getIsoDate(start);
    const stats = await fetchUsageStats(start.getTime(), end.getTime());

    // Deduplicate stats by package - Android can return multiple entries per package
    // Take the maximum value for each package to avoid double-counting
    const dedupedStats = new Map<string, number>();
    for (const stat of stats) {
      const totalSeconds = Math.round((stat.totalTimeMs ?? 0) / 1000);
      if (totalSeconds <= 0) {
        continue;
      }
      const currentMax = dedupedStats.get(stat.packageName) ?? 0;
      dedupedStats.set(stat.packageName, Math.max(currentMax, totalSeconds));
    }

    for (const [packageName, totalSeconds] of dedupedStats.entries()) {
      packagesWithUsage.add(packageName);
      usageByPackage.set(
        packageName,
        (usageByPackage.get(packageName) ?? 0) + totalSeconds
      );
      const key = `${childId}:${packageName}:${usageDate}`;
      usageByKey.set(key, {
        child_id: childId,
        package_name: packageName,
        total_seconds: totalSeconds,
        open_count: 0,
        usage_date: usageDate,
        device_id: deviceId,
        last_synced_at: now.toISOString(),
      });
    }
  }

  const filteredApps =
    packagesWithUsage.size > 0
      ? installedApps.filter((app) => packagesWithUsage.has(app.packageName))
      : installedApps.filter((app) => !app.isSystemApp);
  const appsPayload = filteredApps.map((app) => ({
    child_id: childId,
    app_name: app.appName,
    package_name: app.packageName,
    category: resolveAppCategory(app.category, app.packageName),
    icon_path: null,
  }));

  if (appsPayload.length > 0) {
    const { error: appsError } = await supabase
      .from("child_apps")
      .upsert(appsPayload, { onConflict: "child_id,package_name" });

    if (appsError) {
      throw new Error(appsError.message);
    }
  }

  const usagePayload = Array.from(usageByKey.values());

  if (usagePayload.length > 0) {
    const { error: usageError } = await supabase
      .from("app_usage_daily")
      .upsert(usagePayload, {
        onConflict: "child_id,package_name,usage_date",
      });

    if (usageError) {
      throw new Error(usageError.message);
    }
  }

  // Sync icons for top apps with usage
  let iconsSynced = 0;
  try {
    // Fetch current icon_url status from DB
    const { data: appsWithIcons } = await supabase
      .from("child_apps")
      .select("package_name,icon_url")
      .eq("child_id", childId);

    const iconUrlMap = new Map<string, string | null>();
    for (const app of appsWithIcons ?? []) {
      iconUrlMap.set(app.package_name, app.icon_url);
    }

    const appsForIconSync = Array.from(usageByPackage.entries()).map(
      ([packageName, totalSeconds]) => ({
        packageName,
        totalSeconds,
        iconUrl: iconUrlMap.get(packageName) ?? null,
      })
    );

    iconsSynced = await syncAppIconsForTopApps(childId, appsForIconSync);
  } catch (iconErr) {
    console.warn("Icon sync failed (non-critical):", iconErr);
  }

  return {
    appsSynced: appsPayload.length,
    usageRows: usagePayload.length,
    iconsSynced,
    accessStatus,
  };
}
