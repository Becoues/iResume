import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "@/lib/openai";

export const dynamic = "force-dynamic";

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return key ? "••••••••" : "";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function isMasked(key: unknown): boolean {
  return typeof key !== "string" || key.includes("...") || key.includes("••");
}

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  if (!settings) {
    return NextResponse.json({
      provider: DEFAULT_PROVIDER,
      apiKeyCometapi: "",
      model: DEFAULT_MODEL,
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKeyCometapi: maskApiKey(settings.apiKeyCometapi),
    model: settings.model,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { provider, apiKeyCometapi, model } = body as {
    provider?: string;
    apiKeyCometapi?: string;
    model: string;
  };

  // A masked key means "keep the stored key".
  const resolvedKey = isMasked(apiKeyCometapi) ? undefined : apiKeyCometapi;

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      provider: provider || DEFAULT_PROVIDER,
      model,
      ...(resolvedKey !== undefined ? { apiKeyCometapi: resolvedKey } : {}),
    },
    create: {
      id: 1,
      provider: provider || DEFAULT_PROVIDER,
      model,
      apiKeyCometapi: resolvedKey ?? "",
    },
  });

  return NextResponse.json({
    provider: settings.provider,
    apiKeyCometapi: maskApiKey(settings.apiKeyCometapi),
    model: settings.model,
  });
}
