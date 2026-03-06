import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
}

/** Env-var fallback when no DB settings exist */
function getEnvFallback(): LLMConfig {
  const isYesCode = !!process.env.YESCODE_API_KEY;
  return {
    provider: isYesCode ? "YesCode" : "AiHubMix",
    apiKey: process.env.AIHUBMIX_API_KEY || process.env.YESCODE_API_KEY || "",
    model: process.env.MODEL || "gemini-3.1-pro-preview",
  };
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings?.apiKey) {
    return {
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
    };
  }
  return getEnvFallback();
}

// ---------------------------------------------------------------------------
// Unified streaming interface
// ---------------------------------------------------------------------------

/**
 * Creates a streaming LLM completion that yields text chunks.
 * Automatically selects OpenAI or Anthropic protocol based on provider.
 */
export async function* streamCompletion(
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const config = await getConfig();

  if (config.provider === "YesCode") {
    yield* streamAnthropic(config, systemPrompt, userMessage);
  } else {
    yield* streamOpenAI(config, systemPrompt, userMessage);
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible streaming (AiHubMix)
// ---------------------------------------------------------------------------

async function* streamOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
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
// Anthropic-compatible streaming (YesCode)
// ---------------------------------------------------------------------------

async function* streamAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: "https://co.yes.vg/team",
    defaultHeaders: {
      "user-agent": "claude-code/1.2.3",
    },
  });

  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ---------------------------------------------------------------------------
// Test connection (used by settings API)
// ---------------------------------------------------------------------------

export async function testConnection(
  provider: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (provider === "YesCode") {
      const client = new Anthropic({
        apiKey,
        baseURL: "https://co.yes.vg/team",
        defaultHeaders: { "user-agent": "claude-code/1.2.3" },
      });
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    } else {
      const client = new OpenAI({
        apiKey,
        baseURL: "https://aihubmix.com/v1",
      });
      await client.chat.completions.create({
        model,
        max_completion_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return { ok: false, error: message };
  }
}
