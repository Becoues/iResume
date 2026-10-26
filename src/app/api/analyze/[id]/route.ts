import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "旧版报告生成已停用，请使用面试前简报。" }, { status: 410 });
}
