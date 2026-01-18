export interface AppLimitSuggestion {
  packageName: string;
  appName: string;
  category: string;
  currentUsageMinutes: number;
  suggestedLimitMinutes: number;
  reasoning: string;
  priority: "high" | "medium" | "low";
}

export interface BehavioralInsight {
  type: "pattern" | "concern" | "positive" | "recommendation";
  title: string;
  description: string;
  relatedApps: string[];
  severity?: "info" | "warning" | "critical";
}

export interface AIInsightsResponse {
  childAge: number;
  analysisDate: string;
  overallHealthScore: number;
  totalDailyAverageMinutes: number;
  limitSuggestions: AppLimitSuggestion[];
  behavioralInsights: BehavioralInsight[];
  weeklyTrend: "increasing" | "decreasing" | "stable";
  recommendations: string[];
}

export interface UsageDataForAI {
  packageName: string;
  appName: string;
  category: string;
  dailyUsageMinutes: number[];
  averageMinutes: number;
  currentLimitMinutes: number | null;
}

export interface ChildContextForAI {
  age: number;
  accountCreatedAt: string;
  daysAnalyzed: number;
}
