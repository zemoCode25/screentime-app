import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type OverrideRequestInsert =
  Database["public"]["Tables"]["override_requests"]["Insert"];
type OverrideRequestRow =
  Database["public"]["Tables"]["override_requests"]["Row"];
type AppAccessOverrideRow =
  Database["public"]["Tables"]["app_access_overrides"]["Row"];

export async function createOverrideRequest(
  childId: string,
  packageName: string,
  appName: string
): Promise<OverrideRequestRow> {
  const payload: OverrideRequestInsert = {
    child_id: childId,
    package_name: packageName,
    app_name: appName,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("override_requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function fetchPendingOverrideRequests(
  childId: string
): Promise<OverrideRequestRow[]> {
  const { data, error } = await supabase
    .from("override_requests")
    .select("*")
    .eq("child_id", childId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchActiveOverrides(
  childId: string
): Promise<AppAccessOverrideRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("app_access_overrides")
    .select("*")
    .eq("child_id", childId)
    .eq("status", "active")
    .gt("expires_at", now);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function hasActiveOverride(
  packageName: string,
  overrides: AppAccessOverrideRow[]
): boolean {
  const now = new Date();

  return overrides.some(
    (override) =>
      override.package_name === packageName &&
      override.status === "active" &&
      new Date(override.expires_at) > now
  );
}

export function getActiveOverride(
  packageName: string,
  overrides: AppAccessOverrideRow[]
): AppAccessOverrideRow | null {
  const now = new Date();

  const active = overrides.find(
    (override) =>
      override.package_name === packageName &&
      override.status === "active" &&
      new Date(override.expires_at) > now
  );

  return active ?? null;
}
