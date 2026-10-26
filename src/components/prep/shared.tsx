"use client";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import { EvidenceItem } from "@/lib/prep-contract";

export async function apiJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      data?.error || data?.message || `请求失败（${res.status}），请稍后重试。`,
    );
  return data as T;
}
export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Spinner({ label = "正在加载…" }: { label?: string }) {
  return (
    <span className="inline-loading">
      <Loader2 className="spin" size={17} />
      {label}
    </span>
  );
}
export function Evidence({ evidence }: { evidence: EvidenceItem }) {
  return (
    <details className="evidence">
      <summary>
        <span>
          {evidence.verified ? <Check size={13} /> : <AlertCircle size={13} />}{" "}
          {evidence.verified ? "查看原文依据" : "依据待核实"}
        </span>
        <ChevronDown size={14} />
      </summary>
      <blockquote>
        {evidence.quote || "简历中未找到可直接引用的依据，请在面试中确认。"}
      </blockquote>
    </details>
  );
}
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
export function statusText(status?: string) {
  return (
    (
      {
        running: "准备中",
        completed: "简报已就绪",
        failed: "需重试",
        idle: "待生成",
      } as Record<string, string>
    )[status || "idle"] || "待生成"
  );
}
