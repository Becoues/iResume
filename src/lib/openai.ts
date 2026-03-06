import OpenAI from "openai";
import { prisma } from "@/lib/db";

const PROVIDER_BASE_URLS: Record<string, string> = {
  AiHubMix: "https://aihubmix.com/v1",
  YesCode: "https://co.yes.vg/team",
};

/** Env-var fallback when no DB settings exist */
function getEnvFallback() {
  const apiKey =
    process.env.AIHUBMIX_API_KEY || process.env.YESCODE_API_KEY || "";
  const baseURL = process.env.YESCODE_API_KEY
    ? PROVIDER_BASE_URLS.YesCode
    : PROVIDER_BASE_URLS.AiHubMix;
  const model = process.env.MODEL || "gemini-3.1-pro-preview";
  return { apiKey, baseURL, model };
}

export async function getOpenAIClient(): Promise<OpenAI> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  if (settings?.apiKey) {
    const baseURL =
      PROVIDER_BASE_URLS[settings.provider] ?? PROVIDER_BASE_URLS.AiHubMix;
    return new OpenAI({ apiKey: settings.apiKey, baseURL });
  }

  const { apiKey, baseURL } = getEnvFallback();
  return new OpenAI({ apiKey, baseURL });
}

export async function getModel(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.model || getEnvFallback().model;
}
