import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  denyOverride,
  fetchActiveOverridesForChild,
  fetchAllOverrideRequests,
  fetchPendingOverrideRequests,
  grantOverride,
  revokeOverride,
} from "@/src/features/parent/services/override-service";

export function usePendingOverrideRequests(parentUserId?: string) {
  return useQuery({
    queryKey: ["parent", "override-requests", "pending", parentUserId],
    queryFn: () => fetchPendingOverrideRequests(parentUserId as string),
    enabled: Boolean(parentUserId),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAllOverrideRequests(parentUserId?: string, limit = 50) {
  return useQuery({
    queryKey: ["parent", "override-requests", "all", parentUserId, limit],
    queryFn: () => fetchAllOverrideRequests(parentUserId as string, limit),
    enabled: Boolean(parentUserId),
  });
}

export function useGrantOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      parentUserId,
      durationMinutes,
      note,
    }: {
      requestId: string;
      parentUserId: string;
      durationMinutes: number;
      note?: string;
    }) => grantOverride(requestId, parentUserId, durationMinutes, note),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["parent", "override-requests"],
      });
      queryClient.invalidateQueries({
        queryKey: ["app-access-overrides"],
      });
    },
  });
}

export function useDenyOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      parentUserId,
      note,
    }: {
      requestId: string;
      parentUserId: string;
      note?: string;
    }) => denyOverride(requestId, parentUserId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["parent", "override-requests"],
      });
    },
  });
}

export function useActiveOverridesForChild(childId?: string) {
  return useQuery({
    queryKey: ["app-access-overrides", "child", childId],
    queryFn: () => fetchActiveOverridesForChild(childId as string),
    enabled: Boolean(childId),
  });
}

export function useRevokeOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      overrideId,
      parentUserId,
    }: {
      overrideId: string;
      parentUserId: string;
    }) => revokeOverride(overrideId, parentUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["app-access-overrides"],
      });
    },
  });
}
