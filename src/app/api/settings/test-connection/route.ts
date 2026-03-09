import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { testConnection } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  let { apiKey, model, provider } = body as {
    apiKey: string;
    model: string;
    provider: string;
  };

  provider = provider || "AiHubMix";

  // Resolve masked key from DB
  if (typeof apiKey === "string" && (apiKey.includes("...") || apiKey.includes("••"))) {
    const stored = await prisma.settings.findUnique({ where: { id: 1 } });
    if (stored) {
      apiKey =
        provider === "DeerAPI"
          ? stored.apiKeyDeerapi
          : stored.apiKeyAihubmix;
    } else {
      apiKey = "";
    }
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API Key 未填写" });
  }

  const result = await testConnection(apiKey, model, provider);
  return NextResponse.json(result);
}
