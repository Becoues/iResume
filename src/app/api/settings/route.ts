import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return key ? "••••••••" : "";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  if (!settings) {
    return NextResponse.json({
      provider: "AiHubMix",
      apiKey: "",
      model: "gemini-3.1-pro-preview",
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKey: maskApiKey(settings.apiKey),
    model: settings.model,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { provider, apiKey, model } = body as {
    provider: string;
    apiKey: string;
    model: string;
  };

  // If the apiKey contains "..." it's the masked display value — don't overwrite
  const isKeyUnchanged = typeof apiKey === "string" && apiKey.includes("...");

  const data: Record<string, string> = { provider, model };
  if (!isKeyUnchanged && typeof apiKey === "string") {
    data.apiKey = apiKey;
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: {
      id: 1,
      provider,
      model,
      apiKey: isKeyUnchanged ? "" : apiKey,
    },
  });

  return NextResponse.json({
    provider: settings.provider,
    apiKey: maskApiKey(settings.apiKey),
    model: settings.model,
  });
}
