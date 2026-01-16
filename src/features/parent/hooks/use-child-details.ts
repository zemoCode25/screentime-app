import { useQuery } from "@tanstack/react-query";

import {
  fetchChildAppDetailedUsage,
  fetchChildApps,
  fetchChildAppUsageDetails,
  fetchChildById,
  fetchChildUsageSummary,
} from "@/src/features/parent/services/children-service";

export function useChildDetails(childId?: string) {
  return useQuery({
    queryKey: ["children", "detail", childId],
    queryFn: () => fetchChildById(childId as string),
    enabled: Boolean(childId),
  });
}

export function useChildApps(childId?: string) {
  return useQuery({
    queryKey: ["children", "apps", childId],
    queryFn: () => fetchChildApps(childId as string),
    enabled: Boolean(childId),
  });
}

export function useChildUsageSummary(childId?: string) {
  return useQuery({
    queryKey: ["children", "usage-summary", childId],
    queryFn: () => fetchChildUsageSummary(childId as string),
    enabled: Boolean(childId),
  });
}

export function useChildAppUsageDetails(childId?: string) {
  return useQuery({
    queryKey: ["children", "app-usage-details", childId],
    queryFn: () => fetchChildAppUsageDetails(childId as string),
    enabled: Boolean(childId),
  });
}

export function useChildAppDetailedUsage(
  childId?: string,
  packageName?: string
) {
  return useQuery({
    queryKey: ["children", "app-detailed-usage", childId, packageName],
    queryFn: () =>
      fetchChildAppDetailedUsage(childId as string, packageName as string),
    enabled: Boolean(childId) && Boolean(packageName),
  });
}
