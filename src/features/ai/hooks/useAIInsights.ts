import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateInsights } from "@/src/features/ai/services/gemini-insights";
import { useUsageAnalytics } from "./useUsageAnalytics";
import type { AIInsightsResponse } from "@/src/features/ai/types/ai-responses";

const DEFAULT_ANALYSIS_DAYS = 14;

export function useAIInsights(
  childId?: string,
  analysisDays: number = DEFAULT_ANALYSIS_DAYS
) {
  const queryClient = useQueryClient();

  const {
    data: analyticsData,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
  } = useUsageAnalytics(childId, analysisDays);

  const insightsQuery = useQuery({
    queryKey: ["ai", "insights", childId, analysisDays],
    queryFn: async (): Promise<AIInsightsResponse> => {
      if (!analyticsData) {
        const error = new Error("No analytics data available");
        if (__DEV__) {
          console.error("AI insights skipped: missing analytics data", {
            childId,
            analysisDays,
          });
        }
        throw error;
      }
      try {
        return await generateInsights(
          analyticsData.childContext,
          analyticsData.usageData
        );
      } catch (error) {
        if (__DEV__) {
          console.error("AI insights generation failed", {
            childId,
            analysisDays,
            usageCount: analyticsData.usageData?.length ?? 0,
            error,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(childId) && Boolean(analyticsData),
    staleTime: 30 * 60 * 1000, // 30 minutes - AI insights don't change frequently
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 1, // Only retry once for AI calls
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!analyticsData) {
        const error = new Error("No analytics data available");
        if (__DEV__) {
          console.error("AI insights refresh skipped: missing analytics data", {
            childId,
            analysisDays,
          });
        }
        throw error;
      }
      try {
        return await generateInsights(
          analyticsData.childContext,
          analyticsData.usageData
        );
      } catch (error) {
        if (__DEV__) {
          console.error("AI insights refresh failed", {
            childId,
            analysisDays,
            usageCount: analyticsData.usageData?.length ?? 0,
            error,
          });
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["ai", "insights", childId, analysisDays],
        data
      );
    },
  });

  return {
    insights: insightsQuery.data,
    isLoading: isLoadingAnalytics || insightsQuery.isLoading,
    isFetching: insightsQuery.isFetching,
    error: analyticsError || insightsQuery.error,
    hasData: Boolean(analyticsData?.usageData?.length),
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}

export function useLimitSuggestions(childId?: string) {
  const { insights, isLoading, error } = useAIInsights(childId);

  return {
    suggestions: insights?.limitSuggestions ?? [],
    isLoading,
    error,
  };
}
