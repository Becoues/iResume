import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { testConnection } from "@/lib/openai";

export async function POST(request: Request) {
  const body = await request.json();
  let { apiKey, model } = body as {
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

  const result = await testConnection(apiKey, model);
  return NextResponse.json(result);
}
