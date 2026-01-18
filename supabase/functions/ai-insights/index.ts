import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai@0.24.1";

type AppLimitSuggestion = {
  packageName: string;
  appName: string;
  category: string;
  currentUsageMinutes: number;
  suggestedLimitMinutes: number;
  reasoning: string;
  priority: "high" | "medium" | "low";
};

type BehavioralInsight = {
  type: "pattern" | "concern" | "positive" | "recommendation";
  title: string;
  description: string;
  relatedApps: string[];
  severity?: "info" | "warning" | "critical";
};

type AIInsightsResponse = {
  childAge: number;
  analysisDate: string;
  overallHealthScore: number;
  totalDailyAverageMinutes: number;
  limitSuggestions: AppLimitSuggestion[];
  behavioralInsights: BehavioralInsight[];
  weeklyTrend: "increasing" | "decreasing" | "stable";
  recommendations: string[];
};

type UsageDataForAI = {
  packageName: string;
  appName: string;
  category: string;
  dailyUsageMinutes: number[];
  averageMinutes: number;
  currentLimitMinutes: number | null;
};

type ChildContextForAI = {
  age: number;
  accountCreatedAt: string;
  daysAnalyzed: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const aiInsightsResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    childAge: { type: SchemaType.NUMBER },
    analysisDate: { type: SchemaType.STRING },
    overallHealthScore: { type: SchemaType.NUMBER },
    totalDailyAverageMinutes: { type: SchemaType.NUMBER },
    limitSuggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          packageName: { type: SchemaType.STRING },
          appName: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          currentUsageMinutes: { type: SchemaType.NUMBER },
          suggestedLimitMinutes: { type: SchemaType.NUMBER },
          reasoning: { type: SchemaType.STRING },
          priority: { type: SchemaType.STRING },
        },
        required: [
          "packageName",
          "appName",
          "category",
          "currentUsageMinutes",
          "suggestedLimitMinutes",
          "reasoning",
          "priority",
        ],
      },
    },
    behavioralInsights: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          relatedApps: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          severity: { type: SchemaType.STRING },
        },
        required: ["type", "title", "description", "relatedApps"],
      },
    },
    weeklyTrend: { type: SchemaType.STRING },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    "childAge",
    "analysisDate",
    "overallHealthScore",
    "totalDailyAverageMinutes",
    "limitSuggestions",
    "behavioralInsights",
    "weeklyTrend",
    "recommendations",
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildInsightsPrompt(
  childContext: ChildContextForAI,
  usageData: UsageDataForAI[]
): string {
  const usageDataJson = JSON.stringify(
    usageData.map((app) => ({
      packageName: app.packageName,
      appName: app.appName,
      category: app.category,
      dailyUsageMinutes: app.dailyUsageMinutes,
      averageMinutesPerDay: app.averageMinutes,
      currentLimitMinutes: app.currentLimitMinutes,
    })),
    null,
    2
  );

  return `You are an expert child psychologist and digital wellness advisor. Analyze this child's app usage data and provide insights.

CHILD PROFILE:
- Age: ${childContext.age} years old
- Account created: ${childContext.accountCreatedAt}
- Days of data analyzed: ${childContext.daysAnalyzed}

USAGE DATA (last ${childContext.daysAnalyzed} days):
${usageDataJson}

APP CATEGORIES:
- education: Learning apps, educational games
- games: Entertainment games
- video: Video streaming, YouTube
- social: Social media apps
- creativity: Drawing, music, content creation
- productivity: Tools, utilities
- communication: Messaging, calls
- utilities: System apps
- other: Uncategorized

Provide a comprehensive analysis including:

1. OVERALL HEALTH SCORE (0-100):
   - Consider age-appropriate limits (AAP guidelines recommend max 1-2 hours for ages 2-5, consistent limits for 6+)
   - Balance between educational and entertainment content
   - Usage patterns (binge vs distributed usage)

2. BEHAVIORAL INSIGHTS:
   - Patterns you observe (types: "pattern", "concern", "positive", "recommendation")
   - Each insight should have a clear title and description
   - Include severity for concerns: "info", "warning", or "critical"

3. LIMIT SUGGESTIONS:
   For each app that needs attention, provide:
   - Suggested daily limit in minutes
   - Clear reasoning based on age and app category
   - Priority: "high" (immediate action), "medium" (should address), "low" (nice to have)

4. WEEKLY TREND:
   - Is usage "increasing", "decreasing", or "stable"?

5. RECOMMENDATIONS:
   - 3-5 actionable recommendations for parents
   - Focus on positive reinforcement and healthy habits

Consider these guidelines:
- Ages 2-5: Prioritize educational content, max 1 hour/day
- Ages 6-12: Balanced mix, establish clear limits, monitor social media
- Ages 13+: More autonomy but still need boundaries on social media
- Late-night usage (after 9 PM) is concerning for sleep
- Weekend vs weekday patterns matter
- High social media usage warrants closer attention

Respond with valid JSON matching the required schema.`;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: { childContext?: ChildContextForAI; usageData?: UsageDataForAI[] };
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const { childContext, usageData } = payload ?? {};
  if (!childContext || !usageData || !Array.isArray(usageData)) {
    return jsonResponse({ error: "Missing childContext or usageData" }, 400);
  }

  if (usageData.length === 0) {
    return jsonResponse({ error: "No usage data provided" }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY is not set" }, 500);
  }

  const modelName = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: aiInsightsResponseSchema,
    },
  });

  const prompt = buildInsightsPrompt(childContext, usageData);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText) as AIInsightsResponse;

    const normalized: AIInsightsResponse = {
      childAge: parsed.childAge ?? childContext.age,
      analysisDate:
        parsed.analysisDate ?? new Date().toISOString().split("T")[0],
      overallHealthScore: Math.max(
        0,
        Math.min(100, parsed.overallHealthScore ?? 50)
      ),
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

    return jsonResponse(normalized);
  } catch (error) {
    console.error("AI insights generation failed", error);
    return jsonResponse({ error: "AI insights generation failed" }, 502);
  }
});
