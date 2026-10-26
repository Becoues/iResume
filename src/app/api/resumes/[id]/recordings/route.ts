import { NextResponse } from "next/server";

function retired() {
  return NextResponse.json({ error: "录音功能已停用。已有数据保留，删除对应简历时一并清理。" }, { status: 410 });
}

export async function GET() { return retired(); }
export async function POST() { return retired(); }
