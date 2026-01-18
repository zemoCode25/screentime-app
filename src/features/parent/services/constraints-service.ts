import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

export type ChildTimeRuleRow =
  Database["public"]["Tables"]["child_time_rules"]["Row"];
export type ChildUsageSettingsRow =
  Database["public"]["Tables"]["child_usage_settings"]["Row"];

export type ChildTimeRuleInput = {
  days: number[];
  startSeconds: number;
  endSeconds: number;
};

export type SaveChildConstraintsInput = {
  bedtimes: ChildTimeRuleInput[];
  focusTimes: ChildTimeRuleInput[];
  dailyLimitSeconds: number;
  weekendBonusSeconds: number;
};

export type ChildConstraints = {
  bedtimes: ChildTimeRuleRow[];
  focusTimes: ChildTimeRuleRow[];
  usageSettings: ChildUsageSettingsRow | null;
};

export async function fetchChildConstraints(
  childId: string
): Promise<ChildConstraints> {
  const [{ data: rules, error: rulesError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase
        .from("child_time_rules")
        .select(
          "id,child_id,rule_type,days,start_seconds,end_seconds,created_at,updated_at"
        )
        .eq("child_id", childId)
        .order("created_at", { ascending: true }),
      supabase
        .from("child_usage_settings")
        .select(
          "child_id,daily_limit_seconds,weekend_bonus_seconds,created_at,updated_at"
        )
        .eq("child_id", childId)
        .maybeSingle(),
    ]);

  if (rulesError) {
    throw new Error(rulesError.message);
  }

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const bedtimes = (rules ?? []).filter((rule) => rule.rule_type === "bedtime");
  const focusTimes = (rules ?? []).filter((rule) => rule.rule_type === "focus");

  return {
    bedtimes,
    focusTimes,
    usageSettings: settings ?? null,
  };
}

export async function saveChildConstraints(
  childId: string,
  input: SaveChildConstraintsInput
): Promise<void> {
  const { error: settingsError } = await supabase
    .from("child_usage_settings")
    .upsert(
      {
        child_id: childId,
        daily_limit_seconds: input.dailyLimitSeconds,
        weekend_bonus_seconds: input.weekendBonusSeconds,
      },
      { onConflict: "child_id" }
    );

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const { error: deleteError } = await supabase
    .from("child_time_rules")
    .delete()
    .eq("child_id", childId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const timeRulesPayload = [
    ...input.bedtimes.map((rule) => ({
      child_id: childId,
      rule_type: "bedtime",
      days: rule.days,
      start_seconds: rule.startSeconds,
      end_seconds: rule.endSeconds,
    })),
    ...input.focusTimes.map((rule) => ({
      child_id: childId,
      rule_type: "focus",
      days: rule.days,
      start_seconds: rule.startSeconds,
      end_seconds: rule.endSeconds,
    })),
  ];

  if (timeRulesPayload.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("child_time_rules")
    .insert(timeRulesPayload);

  if (insertError) {
    throw new Error(insertError.message);
  }
}
