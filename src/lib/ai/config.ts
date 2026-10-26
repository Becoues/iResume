import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import type { AiProvider, AiSettings } from "../prep-contract";

export class ConfigurationError extends Error {}
export interface RuntimeConfig {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  region: string;
  authMode: "default" | "apiKey";
  apiKey: string;
  bedrockApiKey: string;
}
type Stored = {
  provider: string;
  model: string;
  baseUrl?: string;
  region?: string;
  authMode?: string;
  apiKeyCometapi?: string;
  apiKeyEncrypted?: string;
  bedrockKeyEncrypted?: string;
} | null;
const inputSchema = z.object({
  provider: z.enum(["CometAPI", "OpenAI-compatible", "Bedrock"]).optional(),
  model: z.string().trim().min(1).max(250).optional(),
  baseUrl: z.string().trim().max(2048).optional(),
  region: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(?:-[a-z]+)+-\d+$/)
    .optional(),
  authMode: z.enum(["default", "apiKey"]).optional(),
  apiKey: z.string().max(16000).optional(),
  bedrockApiKey: z.string().max(16000).optional(),
  clearApiKey: z.boolean().optional(),
  clearBedrockApiKey: z.boolean().optional(),
});
export function validateSettings(value: unknown): Partial<AiSettings> {
  try {
    return inputSchema.parse(value);
  } catch {
    throw new ConfigurationError("模型设置格式不正确");
  }
}
function encryptionKey(secret: string) {
  if (secret.length < 32)
    throw new ConfigurationError(
      "保存密钥需要部署 APP_SECRET（至少 32 字符）；也可由管理员配置环境变量",
    );
  return createHash("sha256").update(secret).digest();
}
export function sealSecret(
  value: string,
  secret = process.env.APP_SECRET ?? "",
) {
  if (!value) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}
export function openSecret(
  value: string,
  secret = process.env.APP_SECRET ?? "",
) {
  if (!value) return "";
  try {
    const [version, iv, tag, data] = value.split(":");
    if (version !== "v1") throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ConfigurationError(
      "已保存的密钥无法解密，请检查 APP_SECRET 或重新保存密钥",
    );
  }
}
function usableKey(value?: string) {
  return value?.trim() && !value.includes("...") && !value.includes("••")
    ? value.trim()
    : "";
}
function validUrl(base: string) {
  try {
    const u = new URL(base);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      (u.protocol !== "https:" &&
        !(
          u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
        ))
    )
      throw new Error();
    return base.replace(/\/$/, "");
  } catch {
    throw new ConfigurationError(
      "接口地址需为 HTTPS URL（本地调试可用 HTTP），且不得包含密钥、用户名或查询参数",
    );
  }
}
export function resolveConfig(
  stored: Stored,
  env: Record<string, string | undefined> = process.env,
  raw: Partial<AiSettings> = {},
): RuntimeConfig {
  const override = validateSettings(raw);
  const provider = (override.provider ||
    stored?.provider ||
    env.AI_PROVIDER ||
    "CometAPI") as AiProvider;
  if (!["CometAPI", "OpenAI-compatible", "Bedrock"].includes(provider))
    throw new ConfigurationError("不支持的模型提供方");
  const changed = !!override.provider && override.provider !== stored?.provider;
  const model =
    override.model ||
    stored?.model ||
    env.AI_MODEL ||
    (provider === "Bedrock" ? "" : "gemini-3.1-flash-lite-preview");
  const baseUrl = validUrl(
    override.baseUrl ||
      (!changed && stored?.baseUrl) ||
      env.AI_BASE_URL ||
      (provider === "OpenAI-compatible"
        ? "https://api.openai.com/v1"
        : "https://api.cometapi.com/v1"),
  );
  const apiKey =
    usableKey(override.apiKey) ||
    (!changed &&
      !override.clearApiKey &&
      (openSecret(stored?.apiKeyEncrypted || "", env.APP_SECRET) ||
        (provider === "CometAPI" ? stored?.apiKeyCometapi : ""))) ||
    (provider === "CometAPI" ? env.COMETAPI_API_KEY : env.OPENAI_API_KEY) ||
    "";
  const bedrockApiKey =
    usableKey(override.bedrockApiKey) ||
    (!override.clearBedrockApiKey &&
      openSecret(stored?.bedrockKeyEncrypted || "", env.APP_SECRET)) ||
    env.AWS_BEARER_TOKEN_BEDROCK ||
    "";
  return Object.freeze({
    provider,
    model,
    baseUrl,
    region: override.region || stored?.region || env.AWS_REGION || "us-west-2",
    authMode:
      override.authMode ||
      (stored?.authMode as "default" | "apiKey") ||
      (bedrockApiKey ? "apiKey" : "default"),
    apiKey,
    bedrockApiKey,
  });
}
export function publicConfig(c: RuntimeConfig): AiSettings {
  return {
    provider: c.provider,
    model: c.model,
    baseUrl: c.baseUrl,
    region: c.region,
    authMode: c.authMode,
    hasApiKey: !!c.apiKey,
    hasBedrockApiKey: !!c.bedrockApiKey,
    configured:
      !!c.model &&
      (c.provider === "Bedrock"
        ? c.authMode === "default" || !!c.bedrockApiKey
        : !!c.apiKey),
  };
}
export function assertConfigured(c: RuntimeConfig) {
  if (!publicConfig(c).configured)
    throw new ConfigurationError("请先在模型设置中配置模型和凭据，再生成简报");
}
export async function getRuntimeConfig(override: Partial<AiSettings> = {}) {
  const stored = await prisma.settings.findUnique({ where: { id: 1 } });
  return resolveConfig(stored, process.env, override);
}
export async function saveSettings(raw: unknown) {
  const body = validateSettings(raw);
  const stored = await prisma.settings.findUnique({ where: { id: 1 } });
  const config = resolveConfig(stored, process.env, body);
  const providerChanged = !!stored && config.provider !== stored.provider;
  const data = {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    region: config.region,
    authMode: config.authMode,
    ...(usableKey(body.apiKey)
      ? {
          apiKeyEncrypted: sealSecret(usableKey(body.apiKey)),
          apiKeyCometapi: "",
        }
      : body.clearApiKey || providerChanged
        ? { apiKeyEncrypted: "", apiKeyCometapi: "" }
        : {}),
    ...(body.clearBedrockApiKey
      ? { bedrockKeyEncrypted: "" }
      : usableKey(body.bedrockApiKey)
        ? { bedrockKeyEncrypted: sealSecret(usableKey(body.bedrockApiKey)) }
        : {}),
  };
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return publicConfig(await getRuntimeConfig());
}
