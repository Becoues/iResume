import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_SECONDS, sessionSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";
const failures = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const previous = failures.get(ip);
  if (previous && previous.until > now && previous.count >= 8) {
    return NextResponse.json({ error: "尝试次数过多，请 10 分钟后重试。" }, { status: 429 });
  }
  let password: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) throw new Error("too large");
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "请输入访问口令。" }, { status: 400 });
  }
  const expected = process.env.APP_PASSWORD;
  if (!expected || !process.env.APP_SECRET || process.env.APP_SECRET.length < 32) {
    return NextResponse.json({ error: "访问保护尚未配置。" }, { status: 503 });
  }
  const correct = typeof password === "string" && password.length <= 1024 &&
    timingSafeEqual(createHash("sha256").update(password).digest(), createHash("sha256").update(expected).digest());
  if (!correct) {
    if (failures.size >= 10_000) failures.clear();
    failures.set(ip, { count: previous && previous.until > now ? previous.count + 1 : 1, until: now + 600_000 });
    return NextResponse.json({ error: "访问口令不正确。" }, { status: 401 });
  }
  failures.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSession(sessionSecret()), {
    httpOnly: true,
    secure: (process.env.APP_ORIGIN || "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
