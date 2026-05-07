import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { withRetry } from "@/lib/retry";

// ---------------------------------------------------------------------------
// Provider & protocol config
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
// Token usage — normalized across providers
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

type ApiProtocol = "chat-completions" | "responses" | "messages" | "gemini";

const PROVIDER_BASE_URLS: Record<string, string> = {
  AiHubMix: "https://aihubmix.com/v1",
  DeerAPI: "https://api.deerapi.com/v1",
  YesCode: "https://co-cdn.yes.vg/team/v1",
};

interface LLMConfig {
  apiKey: string;
  model: string;
  baseURL: string;
  protocol: ApiProtocol;
  provider: string;
}

function detectProtocol(provider: string, model: string): ApiProtocol {
  if (provider === "YesCode") {
    if (model.startsWith("claude-")) return "messages";
    if (model.startsWith("gemini-")) return "gemini";
    return "responses";
  }
  return "chat-completions";
}

async function getConfig(): Promise<LLMConfig> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (settings) {
    const provider = settings.provider || "AiHubMix";
    const apiKey =
      provider === "YesCode"
        ? settings.apiKeyYescode
        : provider === "DeerAPI"
          ? settings.apiKeyDeerapi
          : settings.apiKeyAihubmix;
    if (apiKey) {
      return {
        apiKey,
        model: settings.model,
        baseURL: PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.AiHubMix,
        protocol: detectProtocol(provider, settings.model),
        provider,
      };
    }
  }
  return {
    apiKey: process.env.AIHUBMIX_API_KEY || "",
    model: process.env.MODEL || "gemini-3.1-pro-preview",
    baseURL: PROVIDER_BASE_URLS.AiHubMix,
    protocol: "chat-completions",
    provider: "AiHubMix",
  };
}

// ---------------------------------------------------------------------------
// Anthropic Messages API (/v1/messages)
// ---------------------------------------------------------------------------

function messagesBaseURL(baseURL: string): string {
  return baseURL.replace(/\/v1$/, "");
}

function messagesHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
    "User-Agent": "claude-code/1.0",
  };
}

function messagesMetadata() {
  return { session_id: crypto.randomUUID() };
}

async function messagesCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  const base = messagesBaseURL(config.baseURL);
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: messagesHeaders(config.apiKey),
    signal,
    body: JSON.stringify({
      model: config.model,
      max_tokens: 16384,
      metadata: messagesMetadata(),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  let usage: TokenUsage | null = null;
  if (data.usage) {
    const promptTokens = data.usage.input_tokens ?? 0;
    const completionTokens = data.usage.output_tokens ?? 0;
    usage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
  return { text, usage, model: config.model };
}

async function* messagesStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const base = messagesBaseURL(config.baseURL);
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: messagesHeaders(config.apiKey),
    signal,
    body: JSON.stringify({
      model: config.model,
      max_tokens: 16384,
      stream: true,
      metadata: messagesMetadata(),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.text) {
              yield event.delta.text;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
}

async function messagesTestConnection(
  apiKey: string,
  model: string,
  baseURL: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = messagesBaseURL(baseURL);
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: messagesHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 1,
      metadata: messagesMetadata(),
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// OpenAI Responses API (/v1/responses)
// ---------------------------------------------------------------------------

async function responsesCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const response = await client.responses.create(
    {
      model: config.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      text: { format: { type: "json_object" } },
    },
    { signal },
  );
  let usage: TokenUsage | null = null;
  if (response.usage) {
    const promptTokens = response.usage.input_tokens ?? 0;
    const completionTokens = response.usage.output_tokens ?? 0;
    usage = {
      promptTokens,
      completionTokens,
      totalTokens: response.usage.total_tokens ?? promptTokens + completionTokens,
    };
  }
  return { text: response.output_text, usage, model: config.model };
}

async function* responsesStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const stream = await client.responses.create(
    {
      model: config.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      text: { format: { type: "json_object" } },
      stream: true,
    },
    { signal },
  );

  for await (const event of stream) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

// ---------------------------------------------------------------------------
// Google Gemini API (/v1beta)
// ---------------------------------------------------------------------------

function geminiBaseURL(baseURL: string): string {
  return baseURL.replace(/\/v1$/, "/gemini");
}

async function geminiCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  const base = geminiBaseURL(config.baseURL);
  const res = await fetch(
    `${base}/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let usage: TokenUsage | null = null;
  if (data.usageMetadata) {
    const promptTokens = data.usageMetadata.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata.candidatesTokenCount ?? 0;
    usage = {
      promptTokens,
      completionTokens,
      totalTokens: data.usageMetadata.totalTokenCount ?? promptTokens + completionTokens,
    };
  }
  return { text, usage, model: config.model };
}

async function* geminiStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const base = geminiBaseURL(config.baseURL);
  const res = await fetch(
    `${base}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // skip malformed JSON
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
  }
}

async function geminiTestConnection(
  apiKey: string,
  model: string,
  baseURL: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = geminiBaseURL(baseURL);
  const res = await fetch(
    `${base}/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Hi" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }

  return { ok: true };
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

  if (config.protocol === "messages") {
    return messagesCompletion(config, systemPrompt, userMessage, signal);
  }

  if (config.protocol === "responses") {
    return responsesCompletion(config, systemPrompt, userMessage, signal);
  }

  if (config.protocol === "gemini") {
    return geminiCompletion(config, systemPrompt, userMessage, signal);
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
  });

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

  let usage: TokenUsage | null = null;
  if (response.usage) {
    usage = {
      promptTokens: response.usage.prompt_tokens ?? 0,
      completionTokens: response.usage.completion_tokens ?? 0,
      totalTokens:
        response.usage.total_tokens ??
        (response.usage.prompt_tokens ?? 0) + (response.usage.completion_tokens ?? 0),
    };
  }

  return {
    text: response.choices[0]?.message?.content ?? "",
    usage,
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

  if (config.protocol === "messages") {
    yield* messagesStreamCompletion(config, systemPrompt, userMessage, signal);
    return;
  }

  if (config.protocol === "responses") {
    yield* responsesStreamCompletion(config, systemPrompt, userMessage, signal);
    return;
  }

  if (config.protocol === "gemini") {
    yield* geminiStreamCompletion(config, systemPrompt, userMessage, signal);
    return;
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
  });

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
  provider: string = "AiHubMix",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const baseURL =
      PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.AiHubMix;
    const protocol = detectProtocol(provider, model);

    if (protocol === "messages") {
      return await messagesTestConnection(apiKey, model, baseURL);
    }

    if (protocol === "responses") {
      const client = new OpenAI({ apiKey, baseURL });
      await client.responses.create({
        model,
        input: "Hi",
        max_output_tokens: 1,
      });
      return { ok: true };
    }

    if (protocol === "gemini") {
      return await geminiTestConnection(apiKey, model, baseURL);
    }

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
