import OpenAI from "openai";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

const PROVIDER_BASE_URLS: Record<string, string> = {
  AiHubMix: "https://aihubmix.com/v1",
  DeerAPI: "https://api.deerapi.com/v1",
};

interface LLMConfig {
  apiKey: string;
  model: string;
  baseURL: string;
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings) {
    const provider = settings.provider || "AiHubMix";
    const apiKey =
      provider === "DeerAPI" ? settings.apiKeyDeerapi : settings.apiKeyAihubmix;
    if (apiKey) {
      return {
        apiKey,
        model: settings.model,
        baseURL: PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.AiHubMix,
      };
    }
  }
  return {
    apiKey: process.env.AIHUBMIX_API_KEY || "",
    model: process.env.MODEL || "gemini-3.1-pro-preview",
    baseURL: PROVIDER_BASE_URLS.AiHubMix,
  };
}

// ---------------------------------------------------------------------------
// LLM completion — streaming, yields chunks as they arrive
// ---------------------------------------------------------------------------

/**
 * Sends a chat completion request with streaming enabled. Yields text chunks
 * as they arrive so the client can display progress in real time.
 * The caller is responsible for accumulating chunks and parsing the final JSON.
 */
export async function* streamCompletion(
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const config = await getConfig();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    max_completion_tokens: 65536,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// ---------------------------------------------------------------------------
// Test connection (used by settings API)
// ---------------------------------------------------------------------------

export async function testConnection(
  apiKey: string,
  model: string,
  provider: string = "AiHubMix",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const baseURL =
      PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.AiHubMix;
    const client = new OpenAI({ apiKey, baseURL });
    await client.chat.completions.create({
      model,
      max_completion_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return { ok: false, error: message };
  }
}
