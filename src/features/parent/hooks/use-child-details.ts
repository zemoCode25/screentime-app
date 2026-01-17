import { useQuery } from "@tanstack/react-query";

import {
  CHILD_USAGE_WINDOW_DAYS,
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

export function useChildUsageSummary(childId?: string, windowDays?: number) {
  const resolvedWindowDays = windowDays ?? CHILD_USAGE_WINDOW_DAYS;
  return useQuery({
    queryKey: ["children", "usage-summary", childId, resolvedWindowDays],
    queryFn: () => fetchChildUsageSummary(childId as string, resolvedWindowDays),
    enabled: Boolean(childId),
  });
}

export function useChildAppUsageDetails(childId?: string, windowDays?: number) {
  const resolvedWindowDays = windowDays ?? CHILD_USAGE_WINDOW_DAYS;
  return useQuery({
    queryKey: ["children", "app-usage-details", childId, resolvedWindowDays],
    queryFn: () =>
      fetchChildAppUsageDetails(childId as string, resolvedWindowDays),
    enabled: Boolean(childId),
  });
}

export function useChildAppDetailedUsage(
  childId?: string,
  packageName?: string,
  windowDays?: number
) {
  const resolvedWindowDays = windowDays ?? CHILD_USAGE_WINDOW_DAYS;
  return useQuery({
    queryKey: [
      "children",
      "app-detailed-usage",
      childId,
      packageName,
      resolvedWindowDays,
    ],
    queryFn: () =>
      fetchChildAppDetailedUsage(
        childId as string,
        packageName as string,
        resolvedWindowDays
      ),
    enabled: Boolean(childId) && Boolean(packageName),
  });
}
