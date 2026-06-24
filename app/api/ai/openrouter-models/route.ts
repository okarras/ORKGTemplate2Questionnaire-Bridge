/**
 * Proxies the OpenRouter model catalog to the client.
 * Avoids CORS issues when fetching directly from the browser.
 * Used by ScidQuest AIConfigurationDialog to populate the model search.
 */
import { NextResponse } from "next/server";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export async function GET() {
  const apiKey = process.env.OPEN_ROUTER_KEY?.trim();

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(OPENROUTER_MODELS_URL, { headers });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message =
        typeof errBody.error === "string"
          ? errBody.error
          : `OpenRouter returned ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("openrouter-models proxy error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch OpenRouter models";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}