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

const MODELS_AIHUBMIX = [
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "gpt-5.4", label: "GPT 5.4" },
];

const MODELS_YESCODE = [
  { value: "gpt-5.4", label: "GPT 5.4" },
  { value: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
  { value: "gpt-5.2", label: "GPT 5.2" },
  { value: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
  { value: "gpt-5.1", label: "GPT 5.1" },
  { value: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
  { value: "gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini" },
  { value: "gpt-5.1-codex-max", label: "GPT 5.1 Codex Max" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [provider, setProvider] = useState("AiHubMix");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-3.1-pro-preview");
  const [loadedMaskedKey, setLoadedMaskedKey] = useState("");
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
      setProvider(data.provider || "AiHubMix");
      setApiKey(data.apiKey || "");
      setLoadedMaskedKey(data.apiKey || "");
      setModel(data.model || "gemini-3.1-pro-preview");
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

  // When provider changes, ensure model is valid for that provider
  const models = provider === "YesCode" ? MODELS_YESCODE : MODELS_AIHUBMIX;
  useEffect(() => {
    if (!models.some((m) => m.value === model)) {
      setModel(models[0].value);
    }
  }, [provider, models, model]);

  const handleApiKeyFocus = () => {
    if (apiKey.includes("...") || apiKey.includes("••")) {
      setApiKey("");
      setIsApiKeyEditing(true);
    }
  };

  const handleApiKeyBlur = () => {
    if (isApiKeyEditing && apiKey === "") {
      setApiKey(loadedMaskedKey);
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
        body: JSON.stringify({ provider, apiKey, model }),
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
        body: JSON.stringify({ provider, apiKey, model }),
      });
      const data = await res.json();
      setApiKey(data.apiKey || "");
      setLoadedMaskedKey(data.apiKey || "");
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
              <label className="text-sm font-medium">API 提供商</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={selectClasses}
              >
                <option value="AiHubMix">AiHubMix</option>
                <option value="YesCode">YesCode</option>
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
                placeholder={
                  provider === "YesCode"
                    ? "team-xxxxxxxx..."
                    : "sk-xxxxxxxx..."
                }
                className={selectClasses}
              />
              {loadedMaskedKey && !isApiKeyEditing && (
                <p className="text-xs text-muted-foreground">
                  已配置密钥，点击输入框可重新填写
                </p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={selectClasses}
              >
                {models.map((m) => (
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
