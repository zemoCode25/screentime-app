import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchChildConstraints,
  saveChildConstraints,
  type SaveChildConstraintsInput,
} from "@/src/features/parent/services/constraints-service";

export function useChildConstraints(childId?: string) {
  return useQuery({
    queryKey: ["children", "constraints", childId],
    queryFn: () => fetchChildConstraints(childId as string),
    enabled: Boolean(childId),
  });
}

export function useSaveChildConstraints(childId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveChildConstraintsInput) => {
      if (!childId) {
        throw new Error("Missing child ID.");
      }
      return saveChildConstraints(childId, input);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["children", "constraints", childId],
      }),
  });
}
