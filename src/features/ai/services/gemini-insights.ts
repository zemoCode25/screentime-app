import { getInsightsModel } from "./gemini-client";
import { buildInsightsPrompt } from "./prompt-templates";
import type {
  AIInsightsResponse,
  ChildContextForAI,
  UsageDataForAI,
} from "@/src/features/ai/types/ai-responses";

export async function generateInsights(
  childContext: ChildContextForAI,
  usageData: UsageDataForAI[]
): Promise<AIInsightsResponse> {
  const model = getInsightsModel();
  const prompt = buildInsightsPrompt(childContext, usageData);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  const parsed = JSON.parse(text) as AIInsightsResponse;

  // Validate and normalize the response
  return {
    childAge: parsed.childAge ?? childContext.age,
    analysisDate: parsed.analysisDate ?? new Date().toISOString().split("T")[0],
    overallHealthScore: Math.max(0, Math.min(100, parsed.overallHealthScore ?? 50)),
    totalDailyAverageMinutes: parsed.totalDailyAverageMinutes ?? 0,
    limitSuggestions: (parsed.limitSuggestions ?? []).map((suggestion) => ({
      packageName: suggestion.packageName,
      appName: suggestion.appName,
      category: suggestion.category,
      currentUsageMinutes: suggestion.currentUsageMinutes,
      suggestedLimitMinutes: suggestion.suggestedLimitMinutes,
      reasoning: suggestion.reasoning,
      priority: validatePriority(suggestion.priority),
    })),
    behavioralInsights: (parsed.behavioralInsights ?? []).map((insight) => ({
      type: validateInsightType(insight.type),
      title: insight.title,
      description: insight.description,
      relatedApps: insight.relatedApps ?? [],
      severity: insight.severity ? validateSeverity(insight.severity) : undefined,
    })),
    weeklyTrend: validateTrend(parsed.weeklyTrend),
    recommendations: parsed.recommendations ?? [],
  };
}

function validatePriority(priority: string): "high" | "medium" | "low" {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "medium";
}

function validateInsightType(
  type: string
): "pattern" | "concern" | "positive" | "recommendation" {
  if (
    type === "pattern" ||
    type === "concern" ||
    type === "positive" ||
    type === "recommendation"
  ) {
    return type;
  }
  return "pattern";
}

function validateSeverity(
  severity: string
): "info" | "warning" | "critical" {
  if (severity === "info" || severity === "warning" || severity === "critical") {
    return severity;
  }
  return "info";
}

function validateTrend(trend: string): "increasing" | "decreasing" | "stable" {
  if (trend === "increasing" || trend === "decreasing" || trend === "stable") {
    return trend;
  }
  return "stable";
}
