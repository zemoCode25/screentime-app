import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type AppLimitRow = Database["public"]["Tables"]["app_limits"]["Row"];
type AppLimitInsert = Database["public"]["Tables"]["app_limits"]["Insert"];

export type SaveAppLimitPayload = {
  childId: string;
  packageName: string;
  limitSeconds: number;
  appliesSun: boolean;
  appliesMon: boolean;
  appliesTue: boolean;
  appliesWed: boolean;
  appliesThu: boolean;
  appliesFri: boolean;
  appliesSat: boolean;
  bonusEnabled: boolean;
  bonusSeconds: number;
  bonusStreakTarget: number;
};

/**
 * Fetches the app limit for a specific app
 */
export async function fetchAppLimit(
  childId: string,
  packageName: string
): Promise<AppLimitRow | null> {
  const { data, error } = await supabase
    .from("app_limits")
    .select("*")
    .eq("child_id", childId)
    .eq("package_name", packageName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Saves or updates an app limit
 */
export async function saveAppLimit(
  payload: SaveAppLimitPayload
): Promise<void> {
  const {
    childId,
    packageName,
    limitSeconds,
    appliesSun,
    appliesMon,
    appliesTue,
    appliesWed,
    appliesThu,
    appliesFri,
    appliesSat,
    bonusEnabled,
    bonusSeconds,
    bonusStreakTarget,
  } = payload;

  const upsertData: AppLimitInsert = {
    child_id: childId,
    package_name: packageName,
    limit_seconds: limitSeconds,
    applies_sun: appliesSun,
    applies_mon: appliesMon,
    applies_tue: appliesTue,
    applies_wed: appliesWed,
    applies_thu: appliesThu,
    applies_fri: appliesFri,
    applies_sat: appliesSat,
    bonus_enabled: bonusEnabled,
    bonus_seconds: bonusSeconds,
    bonus_streak_target: bonusStreakTarget,
  };

  const { error } = await supabase.from("app_limits").upsert(upsertData, {
    onConflict: "child_id,package_name",
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Deletes an app limit
 */
export async function deleteAppLimit(
  childId: string,
  packageName: string
): Promise<void> {
  const { error } = await supabase
    .from("app_limits")
    .delete()
    .eq("child_id", childId)
    .eq("package_name", packageName);

  if (error) {
    throw new Error(error.message);
  }
}
