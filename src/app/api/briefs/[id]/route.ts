import { NextResponse } from "next/server";
import {
  startBrief,
  BriefNotFoundError,
  getBriefState,
} from "@/lib/brief-runtime";
import { ConfigurationError } from "@/lib/ai/config";
import { publicError } from "@/lib/ai/client";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "请求参数格式不正确" },
        { status: 400 },
      );
    const mode = body.mode ?? "quick";
    if (mode !== "quick" && mode !== "deep")
      return NextResponse.json(
        { error: "mode 必须为 quick 或 deep" },
        { status: 400 },
      );
    return NextResponse.json(await startBrief(id, mode), {
      status: 202,
    });
  } catch (error) {
    return NextResponse.json(
      { error: publicError(error) },
      {
        status:
          error instanceof BriefNotFoundError
            ? 404
            : error instanceof ConfigurationError ||
                error instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getBriefState(id));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BriefNotFoundError
            ? "简历不存在"
            : publicError(error),
      },
      { status: error instanceof BriefNotFoundError ? 404 : 500 },
    );
  }
}
