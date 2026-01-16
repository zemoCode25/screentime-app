import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createOverrideRequest,
  fetchActiveOverrides,
  fetchPendingOverrideRequests,
} from "@/src/features/child/services/override-service";

export function useCreateOverrideRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      packageName,
      appName,
    }: {
      childId: string;
      packageName: string;
      appName: string;
    }) => createOverrideRequest(childId, packageName, appName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["override-requests"] });
    },
  });
}

export function usePendingOverrideRequests(childId?: string) {
  return useQuery({
    queryKey: ["override-requests", "pending", childId],
    queryFn: () => fetchPendingOverrideRequests(childId as string),
    enabled: Boolean(childId),
  });
}

export function useActiveOverrides(childId?: string) {
  return useQuery({
    queryKey: ["app-access-overrides", "active", childId],
    queryFn: () => fetchActiveOverrides(childId as string),
    enabled: Boolean(childId),
    refetchInterval: 30000, // Refetch every 30 seconds to check for new overrides
  });
}
