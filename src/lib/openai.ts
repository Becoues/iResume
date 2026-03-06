import OpenAI from "openai";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

interface LLMConfig {
  apiKey: string;
  model: string;
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings?.apiKey) {
    return {
      apiKey: settings.apiKey,
      model: settings.model,
    };
  }
  return {
    apiKey: process.env.AIHUBMIX_API_KEY || "",
    model: process.env.MODEL || "gemini-3.1-pro-preview",
  };
}

// ---------------------------------------------------------------------------
// Streaming interface
// ---------------------------------------------------------------------------

/**
 * Creates a streaming LLM completion that yields text chunks.
 * Uses OpenAI-compatible protocol via AiHubMix proxy.
 */
export async function* streamCompletion(
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const config = await getConfig();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://aihubmix.com/v1",
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// ---------------------------------------------------------------------------
// Test connection (used by settings API)
// ---------------------------------------------------------------------------

export async function testConnection(
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://aihubmix.com/v1",
    });
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
