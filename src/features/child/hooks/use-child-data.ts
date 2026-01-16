import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/src/features/auth/hooks/use-auth";
import {
  fetchChildApps,
  fetchChildForUser,
  fetchChildLimits,
  fetchChildUsageDaily,
  fetchChildUsageHourly,
} from "@/src/features/child/services/child-service";

export function useChildProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? null;

  return useQuery({
    queryKey: ["child", "profile", userId],
    queryFn: () => fetchChildForUser(userId as string, email),
    enabled: Boolean(userId),
  });
}

export function useChildApps(childId?: string) {
  return useQuery({
    queryKey: ["child", "apps", childId],
    queryFn: () => fetchChildApps(childId as string),
    enabled: Boolean(childId),
  });
}

export function useChildUsageDaily(childId?: string, startDate?: string) {
  return useQuery({
    queryKey: ["child", "usage", childId, startDate],
    queryFn: () => fetchChildUsageDaily(childId as string, startDate as string),
    enabled: Boolean(childId && startDate),
  });
}

export function useChildUsageHourly(childId?: string, startDate?: string) {
  return useQuery({
    queryKey: ["child", "usage-hourly", childId, startDate],
    queryFn: () =>
      fetchChildUsageHourly(childId as string, startDate as string),
    enabled: Boolean(childId && startDate),
  });
}

export function useChildLimits(childId?: string) {
  return useQuery({
    queryKey: ["child", "limits", childId],
    queryFn: () => fetchChildLimits(childId as string),
    enabled: Boolean(childId),
  });
}
