import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { withRetry } from "@/lib/retry";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 180_000;
const SDK_MAX_RETRIES = 4;
const OUTER_RETRIES = 2;
const OUTER_BASE_DELAY_MS = 800;

function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return true;
  if (err instanceof OpenAI.AuthenticationError) return false;
  if (err instanceof OpenAI.BadRequestError) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /socket|ECONNRESET|ETIMEDOUT|Connection error|fetch failed|network/i.test(msg);
}

// ---------------------------------------------------------------------------
// Token usage
// ---------------------------------------------------------------------------

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  text: string;
  usage: TokenUsage | null;
  model: string;
}

export function addUsage(a: TokenUsage, b: TokenUsage | null): TokenUsage {
  if (!b) return a;
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export const PROVIDER_BASE_URLS: Record<string, string> = {
  CometAPI: "https://api.cometapi.com/v1",
};

export const DEFAULT_PROVIDER = "CometAPI";
export const DEFAULT_MODEL = "gemini-3.1-pro-preview";

function baseURLFor(provider: string): string {
  return PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS[DEFAULT_PROVIDER];
}

interface LLMConfig {
  apiKey: string;
  model: string;
  baseURL: string;
  provider: string;
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings?.apiKeyCometapi) {
    const provider = settings.provider || DEFAULT_PROVIDER;
    return {
      apiKey: settings.apiKeyCometapi,
      model: settings.model,
      baseURL: baseURLFor(provider),
      provider,
    };
  }
  return {
    apiKey: process.env.COMETAPI_API_KEY || "",
    model: process.env.MODEL || DEFAULT_MODEL,
    baseURL: baseURLFor(DEFAULT_PROVIDER),
    provider: DEFAULT_PROVIDER,
  };
}

function createClient(apiKey: string, baseURL: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
  });
}

function normalizeUsage(
  usage: OpenAI.CompletionUsage | undefined,
): TokenUsage | null {
  if (!usage) return null;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
  };
}

// ---------------------------------------------------------------------------
// LLM completion — non-streaming
// ---------------------------------------------------------------------------

export async function completion(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  const config = await getConfig();
  const client = createClient(config.apiKey, config.baseURL);

  const response = await withRetry(
    () =>
      client.chat.completions.create(
        {
          model: config.model,
          stream: false,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        },
        { signal },
      ),
    {
      retries: OUTER_RETRIES,
      baseDelayMs: OUTER_BASE_DELAY_MS,
      isRetryable: isTransientNetworkError,
      signal,
      onRetry: (attempt, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[completion] retry ${attempt + 1}/${OUTER_RETRIES} after: ${msg}`);
      },
    },
  );

  return {
    text: response.choices[0]?.message?.content ?? "",
    usage: normalizeUsage(response.usage),
    model: config.model,
  };
}

// ---------------------------------------------------------------------------
// LLM completion — streaming
// ---------------------------------------------------------------------------

export async function* streamCompletion(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const config = await getConfig();
  const client = createClient(config.apiKey, config.baseURL);

  const stream = await client.chat.completions.create(
    {
      model: config.model,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    },
    { signal },
  );

  try {
    for await (const chunk of stream) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } finally {
    try { stream.controller.abort(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

export async function testConnection(
  apiKey: string,
  model: string,
  provider: string = DEFAULT_PROVIDER,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new OpenAI({ apiKey, baseURL: baseURLFor(provider) });
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
