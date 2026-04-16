import OpenAI from "openai";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Provider & protocol config
// ---------------------------------------------------------------------------

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
): Promise<string> {
  const base = messagesBaseURL(config.baseURL);
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: messagesHeaders(config.apiKey),
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
  return data.content?.[0]?.text ?? "";
}

async function* messagesStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const base = messagesBaseURL(config.baseURL);
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: messagesHeaders(config.apiKey),
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

  while (true) {
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
): Promise<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const response = await client.responses.create({
    model: config.model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    text: { format: { type: "json_object" } },
  });
  return response.output_text;
}

async function* responsesStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const stream = await client.responses.create({
    model: config.model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    text: { format: { type: "json_object" } },
    stream: true,
  });

  for await (const event of stream) {
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
): Promise<string> {
  const base = geminiBaseURL(config.baseURL);
  const res = await fetch(
    `${base}/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function* geminiStreamCompletion(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
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

  while (true) {
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
): Promise<string> {
  const config = await getConfig();

  if (config.protocol === "messages") {
    return messagesCompletion(config, systemPrompt, userMessage);
  }

  if (config.protocol === "responses") {
    return responsesCompletion(config, systemPrompt, userMessage);
  }

  if (config.protocol === "gemini") {
    return geminiCompletion(config, systemPrompt, userMessage);
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    stream: false,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// LLM completion — streaming
// ---------------------------------------------------------------------------

export async function* streamCompletion(
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string> {
  const config = await getConfig();

  if (config.protocol === "messages") {
    yield* messagesStreamCompletion(config, systemPrompt, userMessage);
    return;
  }

  if (config.protocol === "responses") {
    yield* responsesStreamCompletion(config, systemPrompt, userMessage);
    return;
  }

  if (config.protocol === "gemini") {
    yield* geminiStreamCompletion(config, systemPrompt, userMessage);
    return;
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    stream: true,
    response_format: { type: "json_object" },
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
