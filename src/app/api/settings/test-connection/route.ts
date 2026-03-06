import OpenAI from "openai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PROVIDER_BASE_URLS: Record<string, string> = {
  AiHubMix: "https://aihubmix.com/v1",
  YesCode: "https://co.yes.vg/team",
};

export async function POST(request: Request) {
  const body = await request.json();
  let { provider, apiKey, model } = body as {
    provider: string;
    apiKey: string;
    model: string;
  };

  // Resolve masked key from DB
  if (typeof apiKey === "string" && apiKey.includes("...")) {
    const stored = await prisma.settings.findUnique({ where: { id: 1 } });
    apiKey = stored?.apiKey ?? "";
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API Key 未填写" });
  }

  const baseURL = PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.AiHubMix;
  const client = new OpenAI({ apiKey, baseURL });

  try {
    await client.chat.completions.create({
      model,
      max_completion_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message });
  }
}
