import OpenAI from "openai";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  assertConfigured,
  ConfigurationError,
  type RuntimeConfig,
} from "./config";
import { parseJson } from "../brief-validation";

export class ProviderError extends Error {}
export function publicError(error: unknown): string {
  if (error instanceof ConfigurationError || error instanceof ProviderError)
    return error.message;
  if (error instanceof Error && /超时|结构或原文引用/.test(error.message))
    return error.message;
  return "生成失败，请检查模型连接后重试";
}
export async function completeJson(
  config: RuntimeConfig,
  system: string,
  prompt: string,
  signal: AbortSignal,
  maxTokens = 4000,
): Promise<string> {
  assertConfigured(config);
  try {
    if (config.provider === "Bedrock") {
      const client = new BedrockRuntimeClient({
        region: config.region,
        maxAttempts: 1,
        authSchemePreference: [
          config.authMode === "apiKey" ? "httpBearerAuth" : "sigv4",
        ],
        ...(config.authMode === "apiKey"
          ? { token: { token: config.bedrockApiKey } }
          : {}),
      });
      try {
        const response = await client.send(
          new ConverseCommand({
            modelId: config.model,
            system: [{ text: system }],
            messages: [{ role: "user", content: [{ text: prompt }] }],
            inferenceConfig: { maxTokens },
          }),
          { abortSignal: signal },
        );
        const text =
          response.output?.message?.content
            ?.map((block) => ("text" in block ? block.text : ""))
            .join("") || "";
        if (response.stopReason === "max_tokens")
          throw new ProviderError("模型输出被截断，请更换模型后重试");
        if (!text) throw new ProviderError("模型没有返回可读取的文本");
        return text;
      } finally {
        client.destroy();
      }
    }
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: 0,
      timeout: 90_000,
    });
    const response = await client.chat.completions.create(
      {
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
      },
      { signal },
    );
    const choice = response.choices[0];
    if (choice?.finish_reason === "length")
      throw new ProviderError("模型输出被截断，请更换模型后重试");
    if (!choice?.message.content)
      throw new ProviderError("模型没有返回可读取的文本");
    return choice.message.content;
  } catch (error) {
    if (error instanceof ConfigurationError || error instanceof ProviderError)
      throw error;
    if (signal.aborted) throw new ProviderError("生成超时，请稍后重试");
    const e = error as {
      status?: number;
      $metadata?: { httpStatusCode?: number };
      name?: string;
    };
    const status = e.status || e.$metadata?.httpStatusCode;
    if (
      status === 401 ||
      status === 403 ||
      e.name === "CredentialsProviderError"
    )
      throw new ProviderError("模型认证失败，请检查 API Key 或 AWS 权限");
    if (status === 429)
      throw new ProviderError("模型请求额度或频率受限，请稍后重试");
    if (status === 400 || status === 404)
      throw new ProviderError(
        "模型或 JSON 输出参数不受支持，请检查模型标识、地区和接口地址",
      );
    throw new ProviderError("无法连接模型服务，请检查接口地址和网络后重试");
  }
}
export async function testJsonConnection(config: RuntimeConfig) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderError("连接测试超时，请检查模型和网络"));
    }, 20_000);
  });
  try {
    const text = await Promise.race([
      completeJson(
        config,
        "Return only a JSON object.",
        'Return exactly {"ok":true}.',
        controller.signal,
        64,
      ),
      timeout,
    ]);
    const value = parseJson(text) as { ok?: unknown };
    if (value?.ok !== true)
      throw new ProviderError("连接成功，但模型未按要求返回 JSON");
    return { ok: true, message: "连接成功，已验证 JSON 输出" };
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
