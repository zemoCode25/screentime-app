import Constants from "expo-constants";

import { supabase } from "@/lib/supabase";
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
  accessStatus: UsageAccessStatus;
};

const getDeviceId = () => {
  const name = Constants.deviceName?.trim();
  if (name) {
    return `device:${name}`;
  }
  return "device:android";
};

const getIsoDate = (date: Date) => date.toISOString().slice(0, 10);

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
    return { appsSynced: 0, usageRows: 0, accessStatus: "unavailable" };
  }

  const accessStatus = await ensureUsageAccess();
  if (accessStatus !== "granted") {
    return { appsSynced: 0, usageRows: 0, accessStatus };
  }

  const installedApps = await fetchInstalledApps();
  const appsPayload = installedApps.map((app) => ({
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

  const now = new Date();
  const deviceId = getDeviceId();
  const usagePayload: Database["public"]["Tables"]["app_usage_daily"]["Insert"][] =
    [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const day = new Date(now.getTime() - dayOffset * MS_PER_DAY);
    const { start, end } = getDayRange(day);
    const stats = await fetchUsageStats(start.getTime(), end.getTime());

    for (const stat of stats) {
      const totalSeconds = Math.round((stat.totalTimeMs ?? 0) / 1000);
      if (totalSeconds <= 0) {
        continue;
      }
      usagePayload.push({
        child_id: childId,
        package_name: stat.packageName,
        total_seconds: totalSeconds,
        open_count: 0,
        usage_date: getIsoDate(start),
        device_id: deviceId,
        last_synced_at: now.toISOString(),
      });
    }
  }

  if (usagePayload.length > 0) {
    const { error: usageError } = await supabase
      .from("app_usage_daily")
      .upsert(usagePayload, {
        onConflict: "child_id,package_name,usage_date,device_id",
      });

    if (usageError) {
      throw new Error(usageError.message);
    }
  }

  return {
    appsSynced: appsPayload.length,
    usageRows: usagePayload.length,
    accessStatus,
  };
}
