import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Database } from "@/types/database-types";
import { useAuth } from "@/src/features/auth/hooks/use-auth";
import {
  createChild,
  fetchChildrenWithUsageSummary,
} from "@/src/features/parent/services/children-service";

type MotivationType = Database["public"]["Enums"]["motivation_type"];

export type CreateChildInput = {
  name: string;
  childEmail: string;
  age: number;
  gradeLevel?: string | null;
  interests: string[];
  motivations: MotivationType[];
};

export function useChildrenList() {
  return useQuery({
    queryKey: ["children", "list"],
    queryFn: fetchChildrenWithUsageSummary,
  });
}

export function useCreateChild() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChildInput) => {
      if (!session?.user?.id || profile?.role !== "parent") {
        throw new Error("You must be signed in as a parent to add a child.");
      }

      const payload = {
        parent_user_id: session.user.id,
        name: input.name.trim(),
        child_email: input.childEmail.trim().toLowerCase(),
        age: input.age,
        grade_level: input.gradeLevel?.trim() || null,
        interests: input.interests,
        motivations: input.motivations,
      };

      return createChild(payload);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
}
