"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROVIDER = {
  value: "CometAPI",
  label: "CometAPI",
  hint: "https://api.cometapi.com",
};

const DEFAULT_MODEL = "gemini-3.1-pro-preview";

const MODELS = [
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "gpt-5.4", label: "GPT 5.4" },
  { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview ⚡" },
  { value: "qwen3.5-27b", label: "Qwen 3.5 27B ⚡" },
  { value: "deepseek-v3.2", label: "DeepSeek V3.2 ⚡" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setApiKey(data.apiKeyCometapi || "");
      setMaskedKey(data.apiKeyCometapi || "");
      setModel(data.model || DEFAULT_MODEL);
      setIsApiKeyEditing(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
      setTestResult(null);
    }
  }, [open, loadSettings]);

  const handleApiKeyFocus = () => {
    if (apiKey.includes("...") || apiKey.includes("••")) {
      setApiKey("");
      setIsApiKeyEditing(true);
    }
  };

  const handleApiKeyBlur = () => {
    if (isApiKeyEditing && apiKey === "") {
      setApiKey(maskedKey);
      setIsApiKeyEditing(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, provider: PROVIDER.value }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "网络请求失败" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApply = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER.value,
          apiKeyCometapi: apiKey,
          model,
        }),
      });
      const data = await res.json();
      setApiKey(data.apiKeyCometapi || "");
      setMaskedKey(data.apiKeyCometapi || "");
      setIsApiKeyEditing(false);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const selectClasses =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API 设置</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API 渠道</label>
              <select
                value={PROVIDER.value}
                disabled
                className={`${selectClasses} disabled:opacity-70`}
              >
                <option value={PROVIDER.value}>{PROVIDER.label}</option>
              </select>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API Key</label>
              <input
                type="text"
                value={apiKey}
                onFocus={handleApiKeyFocus}
                onBlur={handleApiKeyBlur}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxx..."
                className={selectClasses}
              />
              <p className="text-xs text-muted-foreground">
                {maskedKey && !isApiKeyEditing
                  ? "已配置密钥，点击输入框可重新填写"
                  : `从 ${PROVIDER.label} 获取 Key：${PROVIDER.hint}`}
              </p>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={selectClasses}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  testResult.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="break-all">
                  {testResult.ok
                    ? "连接成功"
                    : `连接失败: ${testResult.error}`}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
          >
            {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
            测试连接
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSaving || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            应用
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
