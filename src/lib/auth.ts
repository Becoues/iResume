const encoder = new TextEncoder();
export const SESSION_COOKIE = "iresume_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
async function key(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function createSession(secret: string, now = Date.now()): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}
export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 1024 || !secret) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const valid = await crypto.subtle.verify("HMAC", await key(secret), fromBase64url(signature), encoder.encode(payload));
    if (!valid) return false;
    const value = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return typeof value.exp === "number" && value.exp > now && value.exp <= now + SESSION_SECONDS * 1000;
  } catch {
    return false;
  }
}
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value) || value.startsWith("/login")) return "/";
  return value;
}
export function requestOriginAllowed(origin: string | null, fetchSite: string | null, expectedOrigin: string): boolean {
  if (fetchSite === "cross-site") return false;
  if (!origin) return true; // Non-browser API clients still require a valid session.
  return origin === expectedOrigin;
}
export function sessionSecret(): string {
  return `${process.env.APP_SECRET || ""}:${process.env.APP_PASSWORD || ""}`;
}
