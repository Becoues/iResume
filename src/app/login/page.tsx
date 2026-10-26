"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { safeReturnPath } from "@/lib/auth";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登录失败，请重试。");
      window.location.assign(safeReturnPath(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败，请重试。");
      setBusy(false);
    }
  }
  return <section className="mx-auto flex min-h-[75vh] max-w-md items-center px-6 py-16">
    <form onSubmit={login} className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><LockKeyhole size={24} /></div>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-600">IRESUME · PRIVATE WORKSPACE</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">为下一场面试做好准备</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">输入访问口令，进入你的面试准备工作台。</p>
      <label htmlFor="password" className="mb-2 mt-8 block text-sm font-medium text-slate-700">访问口令</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required value={password}
        onChange={event => setPassword(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
        {busy ? "正在进入…" : "进入工作台"} {!busy && <ArrowRight size={17} />}
      </button>
    </form>
  </section>;
}
