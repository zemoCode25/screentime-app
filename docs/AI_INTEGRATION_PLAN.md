# AI Integration Plan: Behavioral Insights & App Limit Suggestions

## Overview

Integrate Google Gemini AI to analyze children's app usage patterns and provide intelligent suggestions for app limits. The AI will analyze behavioral patterns and recommend age-appropriate screen time limits.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Parent Dashboard                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Child Card      │  │ AI Insights     │  │ Limit Wizard    │  │
│  │ (existing)      │  │ (new)           │  │ (new)           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI Service Layer                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ src/features/ai/services/gemini-insights.ts                 ││
│  │ - analyzeUsagePatterns()                                    ││
│  │ - suggestAppLimits()                                        ││
│  │ - generateBehavioralInsights()                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Data Sources                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐│
│  │ app_usage     │  │ child_apps    │  │ daily_screentime      ││
│  │ (daily usage) │  │ (app metadata)│  │ (aggregated)          ││
│  └───────────────┘  └───────────────┘  └───────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create AI Service Foundation

**File: `src/features/ai/services/gemini-client.ts`**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(API_KEY!);

  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });
}
```

### Step 2: Define Response Schemas

**File: `src/features/ai/types/ai-responses.ts`**

```typescript
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
  overallHealthScore: number; // 0-100
  totalDailyAverage: number;
  limitSuggestions: AppLimitSuggestion[];
  behavioralInsights: BehavioralInsight[];
  weeklyTrend: "increasing" | "decreasing" | "stable";
  recommendations: string[];
}
```

### Step 3: Create Insights Service

**File: `src/features/ai/services/gemini-insights.ts`**

Core functions:

1. `prepareUsageData()` - Format usage data for AI prompt
2. `generateInsights()` - Main AI call for behavioral analysis
3. `suggestLimits()` - Get AI-recommended limits for specific apps
4. `explainSuggestion()` - Get detailed explanation for a limit

### Step 4: Create Data Aggregation Hook

**File: `src/features/ai/hooks/useUsageAnalytics.ts`**

Aggregate data from:

- `app_usage` table (last 7-30 days)
- `child_apps` table (app categories, current limits)
- `daily_screentime` table (daily totals)

### Step 5: Create UI Components

**File: `src/features/ai/components/AIInsightsCard.tsx`**

- Summary card showing health score and key insights
- Expandable to show detailed behavioral patterns

**File: `src/features/ai/components/LimitSuggestionCard.tsx`**

- Individual app limit suggestion with:
  - Current vs suggested limit comparison
  - One-tap apply button
  - Reasoning tooltip

**File: `src/features/ai/components/InsightsSheet.tsx`**

- Bottom sheet with full AI analysis
- Tabs: Overview | Suggestions | Patterns

### Step 6: Integrate with Parent Dashboard

Add AI insights section to `app/(parent)/children/[id].tsx`:

- "AI Insights" button in header
- Insights summary card below usage chart
- Quick-apply suggested limits

## Prompt Engineering

### Main Analysis Prompt Template

```
You are an expert child psychologist and digital wellness advisor. Analyze this child's app usage data and provide insights.

CHILD PROFILE:
- Age: {age} years old
- Account created: {createdAt}

USAGE DATA (last {days} days):
{usageDataJson}

APP CATEGORIES:
{categoriesJson}

CURRENT LIMITS:
{limitsJson}

Provide:
1. Overall screen time health score (0-100)
2. Behavioral patterns you observe
3. Concerns (if any) about specific apps or usage patterns
4. Recommended daily limits for each app based on:
   - Child's age
   - App category (educational vs entertainment vs social)
   - Current usage patterns
   - Best practices for child development
5. Positive observations to encourage good habits

Consider:
- Age-appropriate screen time (AAP guidelines)
- Balance between educational and entertainment
- Social media risks for different ages
- Sleep hygiene (late-night usage patterns)
- Weekend vs weekday patterns
```

## File Structure

```
src/features/ai/
├── services/
│   ├── gemini-client.ts      # Gemini SDK setup
│   ├── gemini-insights.ts    # Main insights logic
│   └── prompt-templates.ts   # Prompt engineering
├── hooks/
│   ├── useAIInsights.ts      # Main insights hook
│   ├── useUsageAnalytics.ts  # Data aggregation
│   └── useLimitSuggestions.ts # Limit-specific hook
├── components/
│   ├── AIInsightsCard.tsx    # Summary card
│   ├── LimitSuggestionCard.tsx
│   ├── InsightsSheet.tsx     # Full analysis sheet
│   ├── HealthScoreRing.tsx   # Visual score indicator
│   └── PatternChart.tsx      # Usage pattern viz
├── types/
│   └── ai-responses.ts       # TypeScript types
└── index.ts                  # Barrel exports
```

## Database Considerations

### New Table: `ai_insights_cache`

```sql
CREATE TABLE ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  insights_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE(child_id)
);
```

This caches AI responses to:

- Reduce API calls
- Provide instant loading
- Enable offline viewing

### RLS Policy

```sql
CREATE POLICY "Parents can view their children's insights"
  ON ai_insights_cache FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM children WHERE parent_id = auth.uid()
    )
  );
```

## Implementation Order

1. **Phase 1: Foundation** (Steps 1-2)
   - Set up Gemini client
   - Define TypeScript types
   - Add environment variable

2. **Phase 2: Service Layer** (Steps 3-4)
   - Create insights service
   - Build data aggregation hook
   - Test with sample data

3. **Phase 3: UI Components** (Step 5)
   - Build individual components
   - Add loading/error states
   - Test in isolation

4. **Phase 4: Integration** (Step 6)
   - Add to parent dashboard
   - Wire up apply-limit functionality
   - Add cache table and RLS

5. **Phase 5: Polish**
   - Error handling
   - Retry logic
   - Analytics tracking

## Security Considerations

1. **API Key**: Store in environment variable, never commit
2. **Data Minimization**: Only send necessary usage data to AI
3. **No PII**: Don't include child names in AI prompts
4. **Rate Limiting**: Cache responses to avoid API abuse
5. **Validation**: Validate AI responses before applying limits

## Testing Plan

1. Unit tests for data aggregation
2. Mock AI responses for UI testing
3. Integration tests with real Gemini API
4. Manual testing of limit application flow
