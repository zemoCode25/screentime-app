import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteAppLimit,
  fetchAppLimit,
  saveAppLimit,
  type SaveAppLimitPayload,
} from "@/src/features/parent/services/app-limit-service";

/**
 * Hook to fetch an existing app limit
 */
export function useAppLimit(childId?: string, packageName?: string) {
  return useQuery({
    queryKey: ["app-limit", childId, packageName],
    queryFn: () => fetchAppLimit(childId as string, packageName as string),
    enabled: Boolean(childId && packageName),
  });
}

/**
 * Hook to save (upsert) an app limit
 */
export function useSaveAppLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveAppLimitPayload) => saveAppLimit(payload),
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["app-limit", variables.childId, variables.packageName],
      });
      queryClient.invalidateQueries({
        queryKey: ["child", "limits", variables.childId],
      });
    },
  });
}

/**
 * Hook to delete an app limit
 */
export function useDeleteAppLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      packageName,
    }: {
      childId: string;
      packageName: string;
    }) => deleteAppLimit(childId, packageName),
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["app-limit", variables.childId, variables.packageName],
      });
      queryClient.invalidateQueries({
        queryKey: ["child", "limits", variables.childId],
      });
    },
  });
}
