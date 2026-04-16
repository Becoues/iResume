import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return key ? "••••••••" : "";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  if (!settings) {
    return NextResponse.json({
      provider: "AiHubMix",
      apiKeyAihubmix: "",
      apiKeyDeerapi: "",
      apiKeyYescode: "",
      model: "gemini-3.1-pro-preview",
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    apiKeyAihubmix: maskApiKey(settings.apiKeyAihubmix),
    apiKeyDeerapi: maskApiKey(settings.apiKeyDeerapi),
    apiKeyYescode: maskApiKey(settings.apiKeyYescode),
    model: settings.model,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { provider, apiKeyAihubmix, apiKeyDeerapi, apiKeyYescode, model } = body as {
    provider: string;
    apiKeyAihubmix?: string;
    apiKeyDeerapi?: string;
    apiKeyYescode?: string;
    model: string;
  };

  // Build update data — only overwrite keys that are not masked
  const data: Record<string, string> = { provider, model };

  if (
    typeof apiKeyAihubmix === "string" &&
    !apiKeyAihubmix.includes("...") &&
    !apiKeyAihubmix.includes("••")
  ) {
    data.apiKeyAihubmix = apiKeyAihubmix;
  }

  if (
    typeof apiKeyDeerapi === "string" &&
    !apiKeyDeerapi.includes("...") &&
    !apiKeyDeerapi.includes("••")
  ) {
    data.apiKeyDeerapi = apiKeyDeerapi;
  }

  if (
    typeof apiKeyYescode === "string" &&
    !apiKeyYescode.includes("...") &&
    !apiKeyYescode.includes("••")
  ) {
    data.apiKeyYescode = apiKeyYescode;
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: {
      id: 1,
      provider,
      model,
      apiKeyAihubmix:
        typeof apiKeyAihubmix === "string" &&
        !apiKeyAihubmix.includes("...") &&
        !apiKeyAihubmix.includes("••")
          ? apiKeyAihubmix
          : "",
      apiKeyDeerapi:
        typeof apiKeyDeerapi === "string" &&
        !apiKeyDeerapi.includes("...") &&
        !apiKeyDeerapi.includes("••")
          ? apiKeyDeerapi
          : "",
      apiKeyYescode:
        typeof apiKeyYescode === "string" &&
        !apiKeyYescode.includes("...") &&
        !apiKeyYescode.includes("••")
          ? apiKeyYescode
          : "",
    },
  });

  return NextResponse.json({
    provider: settings.provider,
    apiKeyAihubmix: maskApiKey(settings.apiKeyAihubmix),
    apiKeyDeerapi: maskApiKey(settings.apiKeyDeerapi),
    apiKeyYescode: maskApiKey(settings.apiKeyYescode),
    model: settings.model,
  });
}
