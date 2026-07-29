import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_PROVIDER, testConnection } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  let { apiKey } = body as { apiKey: string };
  const { model, provider } = body as { model: string; provider?: string };

  // Resolve masked key from DB
  if (typeof apiKey === "string" && (apiKey.includes("...") || apiKey.includes("••"))) {
    const stored = await prisma.settings.findUnique({ where: { id: 1 } });
    apiKey = stored?.apiKeyCometapi ?? "";
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API Key 未填写" });
  }

  const result = await testConnection(apiKey, model, provider || DEFAULT_PROVIDER);
  return NextResponse.json(result);
}
