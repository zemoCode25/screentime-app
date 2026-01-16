import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database-types";

type OverrideRequestRow =
  Database["public"]["Tables"]["override_requests"]["Row"];
type AppAccessOverrideInsert =
  Database["public"]["Tables"]["app_access_overrides"]["Insert"];
type AppAccessOverrideRow =
  Database["public"]["Tables"]["app_access_overrides"]["Row"];

export type OverrideRequestWithChild = OverrideRequestRow & {
  child_name: string;
};

export async function fetchPendingOverrideRequests(
  parentUserId: string
): Promise<OverrideRequestWithChild[]> {
  const { data, error } = await supabase
    .from("override_requests")
    .select(
      `
      *,
      children!override_requests_child_id_fkey(name)
    `
    )
    .eq("children.parent_user_id", parentUserId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    child_name: row.children?.name ?? "Unknown",
  }));
}

export async function fetchAllOverrideRequests(
  parentUserId: string,
  limit = 50
): Promise<OverrideRequestWithChild[]> {
  const { data, error } = await supabase
    .from("override_requests")
    .select(
      `
      *,
      children!override_requests_child_id_fkey(name)
    `
    )
    .eq("children.parent_user_id", parentUserId)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    child_name: row.children?.name ?? "Unknown",
  }));
}

export async function grantOverride(
  requestId: string,
  parentUserId: string,
  durationMinutes: number,
  note?: string
): Promise<void> {
  // Fetch the request
  const { data: request, error: fetchError } = await supabase
    .from("override_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!request) {
    throw new Error("Override request not found");
  }

  // Calculate expiry time
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  // Create the override
  const overridePayload: AppAccessOverrideInsert = {
    child_id: request.child_id,
    package_name: request.package_name,
    granted_by_parent_id: parentUserId,
    expires_at: expiresAt.toISOString(),
    duration_minutes: durationMinutes,
    reason: note,
    status: "active",
  };

  const { error: insertError } = await supabase
    .from("app_access_overrides")
    .insert(overridePayload);

  if (insertError) {
    throw new Error(insertError.message);
  }

  // Update the request status
  const { error: updateError } = await supabase
    .from("override_requests")
    .update({
      status: "granted",
      granted_by_parent_id: parentUserId,
      responded_at: now.toISOString(),
      response_note: note,
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function denyOverride(
  requestId: string,
  parentUserId: string,
  note?: string
): Promise<void> {
  const now = new Date();

  const { error } = await supabase
    .from("override_requests")
    .update({
      status: "denied",
      granted_by_parent_id: parentUserId,
      responded_at: now.toISOString(),
      response_note: note,
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchActiveOverridesForChild(
  childId: string
): Promise<AppAccessOverrideRow[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("app_access_overrides")
    .select("*")
    .eq("child_id", childId)
    .eq("status", "active")
    .gt("expires_at", now)
    .order("expires_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function revokeOverride(
  overrideId: string,
  parentUserId: string
): Promise<void> {
  // Verify parent owns this override
  const { data: override, error: fetchError } = await supabase
    .from("app_access_overrides")
    .select("*")
    .eq("id", overrideId)
    .eq("granted_by_parent_id", parentUserId)
    .single();

  if (fetchError || !override) {
    throw new Error("Override not found or access denied");
  }

  const { error } = await supabase
    .from("app_access_overrides")
    .update({ status: "revoked" })
    .eq("id", overrideId);

  if (error) {
    throw new Error(error.message);
  }
}
