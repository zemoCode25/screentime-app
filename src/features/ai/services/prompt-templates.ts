import type {
  ChildContextForAI,
  UsageDataForAI,
} from "@/src/features/ai/types/ai-responses";

export function buildInsightsPrompt(
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
