import { supabase } from "@/lib/supabase";
import type {
  AIInsightsResponse,
  ChildContextForAI,
  UsageDataForAI,
} from "@/src/features/ai/types/ai-responses";

type InvokeResult = {
  data: AIInsightsResponse | null;
  error: Error | null;
  response?: Response;
};

type InvokeErrorDetails = {
  message: string;
  status?: number;
  responseText?: string;
};

async function invokeInsights(
  childContext: ChildContextForAI,
  usageData: UsageDataForAI[],
  accessToken?: string
): Promise<InvokeResult> {
  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;

  return supabase.functions.invoke<AIInsightsResponse>("ai-insights", {
    body: {
      childContext,
      usageData,
    },
    headers,
  });
}

async function parseInvokeError(
  error: Error,
  response?: Response
): Promise<InvokeErrorDetails> {
  let responseText = "";
  if (response) {
    try {
      responseText = await response.text();
    } catch (_readError) {
      responseText = "";
    }
  }
  const trimmedResponse = responseText ? responseText.slice(0, 500) : "";
  const status = response?.status;
  if (__DEV__) {
    console.error("AI insights function error", {
      status,
      responseText: trimmedResponse || undefined,
      error,
    });
  }
  let message = error.message || "Failed to generate AI insights";
  if (trimmedResponse) {
    try {
      const parsed = JSON.parse(trimmedResponse) as { error?: string; message?: string };
      message = parsed?.error || parsed?.message || `${message}: ${trimmedResponse}`;
    } catch (_parseError) {
      message = `${message}: ${trimmedResponse}`;
    }
  }
  if (status) {
    message = `AI insights failed (${status}): ${message}`;
  }
  return {
    message,
    status,
    responseText: trimmedResponse || undefined,
  };
}

export async function generateInsights(
  childContext: ChildContextForAI,
  usageData: UsageDataForAI[]
): Promise<AIInsightsResponse> {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? undefined;
  const { data, error, response } = await invokeInsights(
    childContext,
    usageData,
    accessToken
  );

  if (error) {
    const details = await parseInvokeError(error, response);
    if (details.status === 401) {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      const refreshedToken = refreshData?.session?.access_token;
      if (!refreshError && refreshedToken) {
        const retry = await invokeInsights(
          childContext,
          usageData,
          refreshedToken
        );
        if (!retry.error && retry.data) {
          return retry.data;
        }
        if (retry.error) {
          const retryDetails = await parseInvokeError(
            retry.error,
            retry.response
          );
          throw new Error(retryDetails.message);
        }
      }
    }
    throw new Error(details.message);
  }

  if (!data) {
    throw new Error("No AI insights returned");
  }

  return data;
}
