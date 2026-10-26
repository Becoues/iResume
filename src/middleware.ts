import { NextRequest, NextResponse } from "next/server";
import { requestOriginAllowed, SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  if (path === "/api/health") return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  if (!password && process.env.NODE_ENV === "production") {
    return new NextResponse("访问保护尚未配置，请设置 APP_PASSWORD 和 APP_SECRET。", { status: 503 });
  }
  if (password && (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32)) {
    return new NextResponse("访问保护配置不完整。", { status: 503 });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const expected = process.env.APP_ORIGIN || request.nextUrl.origin;
    if (!requestOriginAllowed(request.headers.get("origin"), request.headers.get("sec-fetch-site"), expected)) {
      return NextResponse.json({ error: "请求来源不受信任，请从应用页面重试。" }, { status: 403 });
    }
  }
  if (!password || path === "/login" || path === "/api/auth/login") return NextResponse.next();
  const valid = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!valid) {
    if (isApi) return NextResponse.json({ error: "登录已过期，请重新输入访问口令。" }, { status: 401 });
    const url = new URL("/login", process.env.APP_ORIGIN || request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next();
  if (isApi) response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
