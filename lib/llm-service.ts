/**
 * Client-side LLMService implementation that calls the dynamic-questionier
 * API route for AI text generation. Keeps API keys server-side only.
 */

interface LLMService {
  generateText(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemContext?: string;
    },
  ): Promise<{ text: string; reasoning?: string; usage?: unknown }>;
  isConfigured(): boolean;
}

interface GenerateResponse {
  text: string;
  reasoning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function createApiLLMService(): LLMService {
  return {
    async generateText(prompt, options) {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          temperature: options?.temperature ?? 0.3,
          maxTokens: options?.maxTokens ?? 2000,
          systemContext: options?.systemContext,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const message =
          typeof err?.error === "string"
            ? err.error
            : `API error: ${res.status}`;
        throw new Error(message);
      }

      const data: GenerateResponse = await res.json();

      return {
        text: data.text,
        reasoning: data.reasoning,
        usage: data.usage,
      };
    },

    isConfigured(): boolean {
      return true;
    },
  };
}
