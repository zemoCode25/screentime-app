import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type ChildRow = Database["public"]["Tables"]["children"]["Row"];
type ChildAppRow = Database["public"]["Tables"]["child_apps"]["Row"];
type AppUsageRow = Database["public"]["Tables"]["app_usage_daily"]["Row"];
type AppUsageHourlyRow =
  Database["public"]["Tables"]["app_usage_hourly"]["Row"];
type AppLimitRow = Database["public"]["Tables"]["app_limits"]["Row"];

type MockAppSeed = {
  appName: string;
  packageName: string;
  category: Database["public"]["Enums"]["app_category"];
  baseSeconds: number;
  baseOpens: number;
};

const MOCK_DEVICE_ID = "mock-device";
const MOCK_APPS: MockAppSeed[] = [
  {
    appName: "YouTube",
    packageName: "com.google.android.youtube",
    category: "video",
    baseSeconds: 5400,
    baseOpens: 18,
  },
  {
    appName: "Roblox",
    packageName: "com.roblox.client",
    category: "games",
    baseSeconds: 4200,
    baseOpens: 12,
  },
  {
    appName: "Chrome",
    packageName: "com.android.chrome",
    category: "productivity",
    baseSeconds: 1800,
    baseOpens: 22,
  },
  {
    appName: "WhatsApp",
    packageName: "com.whatsapp",
    category: "communication",
    baseSeconds: 900,
    baseOpens: 35,
  },
  {
    appName: "Khan Academy",
    packageName: "org.khanacademy.android",
    category: "education",
    baseSeconds: 1500,
    baseOpens: 8,
  },
  {
    appName: "Calculator",
    packageName: "com.android.calculator2",
    category: "utilities",
    baseSeconds: 0,
    baseOpens: 0,
  },
];

const getIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

export async function seedChildMockUsage(childId: string) {
  const now = new Date();
  const appsPayload = MOCK_APPS.map((app) => ({
    child_id: childId,
    app_name: app.appName,
    package_name: app.packageName,
    category: app.category,
    icon_path: null,
  }));

  const { error: appsError } = await supabase
    .from("child_apps")
    .upsert(appsPayload, { onConflict: "child_id,package_name" });

  if (appsError) {
    throw new Error(appsError.message);
  }

  const usagePayload: Database["public"]["Tables"]["app_usage_daily"]["Insert"][] =
    [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const usageDate = new Date(now);
    usageDate.setDate(now.getDate() - dayOffset);
    const usageDateString = getIsoDate(usageDate);
    const dayFactor = 1 - dayOffset * 0.08;

    for (const app of MOCK_APPS) {
      const totalSeconds = Math.max(
        Math.round(app.baseSeconds * dayFactor),
        0
      );
      const openCount = Math.max(Math.round(app.baseOpens * dayFactor), 0);

      if (totalSeconds === 0 && openCount === 0) {
        continue;
      }

      usagePayload.push({
        child_id: childId,
        package_name: app.packageName,
        total_seconds: totalSeconds,
        open_count: openCount,
        usage_date: usageDateString,
        device_id: MOCK_DEVICE_ID,
        last_synced_at: now.toISOString(),
      });
    }
  }

  if (usagePayload.length === 0) {
    return;
  }

  const { error: usageError } = await supabase
    .from("app_usage_daily")
    .upsert(usagePayload, {
      onConflict: "child_id,package_name,usage_date",
    });

  if (usageError) {
    throw new Error(usageError.message);
  }
}
