/**
 * Server-side AI text generation API.
 * Proxies LLM requests to avoid exposing API keys to the client.
 * Used by ScidQuest LLMService implementation.
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface GenerateTextRequestBody {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemContext?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Add OPENAI_API_KEY to .env.local in the project root and restart the dev server. See .env.example for the variable name.",
      },
      { status: 503 },
    );
  }

  let body: GenerateTextRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, temperature = 0.3, maxTokens = 2000, systemContext } = body;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { error: "prompt is required and must be a string" },
      { status: 400 },
    );
  }

  try {
    const openai = createOpenAI({ apiKey });
    const model = openai("gpt-4o-mini");
    const result = await generateText({
      model,
      system: systemContext,
      prompt,
      temperature,
      maxOutputTokens: maxTokens,
    });

    return NextResponse.json({
      text: result.text,
      reasoning: result.finishReason,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("AI generate error:", err);
    const message = err instanceof Error ? err.message : "AI generation failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
