import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("EXPO_PUBLIC_GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

export const aiInsightsResponseSchema = {
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

export function getInsightsModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: aiInsightsResponseSchema,
    },
  });
}

export { genAI };
