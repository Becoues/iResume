import { NextResponse } from "next/server";
import {
  getRuntimeConfig,
  publicConfig,
  saveSettings,
  ConfigurationError,
} from "@/lib/ai/config";
import { publicError } from "@/lib/ai/client";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(publicConfig(await getRuntimeConfig()));
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  try {
    return NextResponse.json(await saveSettings(await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: publicError(error) },
      {
        status:
          error instanceof ConfigurationError || error instanceof SyntaxError
            ? 400
            : 500,
      },
    );
  }
}
