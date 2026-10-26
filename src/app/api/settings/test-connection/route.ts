import { NextResponse } from "next/server";
import { getRuntimeConfig, validateSettings } from "@/lib/ai/config";
import { publicError, testJsonConnection } from "@/lib/ai/client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const body = validateSettings(await request.json());
    return NextResponse.json(
      await testJsonConnection(await getRuntimeConfig(body)),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: publicError(error) },
      { status: 400 },
    );
  }
}
