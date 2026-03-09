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

const PROVIDERS = [
  { value: "AiHubMix", label: "AiHubMix", hint: "https://aihubmix.com" },
  { value: "DeerAPI", label: "DeerAPI (小鹿API)", hint: "https://api.deerapi.com" },
];

const MODELS = [
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "gpt-5.4", label: "GPT 5.4" },
  { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview ⚡" },
  { value: "qwen3.5-27b", label: "Qwen 3.5 27B ⚡" },
  { value: "deepseek-v3.2", label: "DeepSeek V3.2 ⚡" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [provider, setProvider] = useState("AiHubMix");
  const [model, setModel] = useState("gemini-3.1-pro-preview");

  // Per-provider API key state
  const [keyAihubmix, setKeyAihubmix] = useState("");
  const [keyDeerapi, setKeyDeerapi] = useState("");
  const [maskedKeyAihubmix, setMaskedKeyAihubmix] = useState("");
  const [maskedKeyDeerapi, setMaskedKeyDeerapi] = useState("");
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  // Current key getter/setter based on active provider
  const currentKey = provider === "DeerAPI" ? keyDeerapi : keyAihubmix;
  const currentMaskedKey = provider === "DeerAPI" ? maskedKeyDeerapi : maskedKeyAihubmix;
  const setCurrentKey = provider === "DeerAPI" ? setKeyDeerapi : setKeyAihubmix;

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setProvider(data.provider || "AiHubMix");
      setKeyAihubmix(data.apiKeyAihubmix || "");
      setKeyDeerapi(data.apiKeyDeerapi || "");
      setMaskedKeyAihubmix(data.apiKeyAihubmix || "");
      setMaskedKeyDeerapi(data.apiKeyDeerapi || "");
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

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setIsApiKeyEditing(false);
    setTestResult(null);
  };

  const handleApiKeyFocus = () => {
    if (currentKey.includes("...") || currentKey.includes("••")) {
      setCurrentKey("");
      setIsApiKeyEditing(true);
    }
  };

  const handleApiKeyBlur = () => {
    if (isApiKeyEditing && currentKey === "") {
      setCurrentKey(currentMaskedKey);
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
        body: JSON.stringify({ apiKey: currentKey, model, provider }),
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
          provider,
          apiKeyAihubmix: keyAihubmix,
          apiKeyDeerapi: keyDeerapi,
          model,
        }),
      });
      const data = await res.json();
      setKeyAihubmix(data.apiKeyAihubmix || "");
      setKeyDeerapi(data.apiKeyDeerapi || "");
      setMaskedKeyAihubmix(data.apiKeyAihubmix || "");
      setMaskedKeyDeerapi(data.apiKeyDeerapi || "");
      setIsApiKeyEditing(false);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const providerHint = PROVIDERS.find((p) => p.value === provider)?.hint || "";

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
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className={selectClasses}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">API Key</label>
              <input
                type="text"
                value={currentKey}
                onFocus={handleApiKeyFocus}
                onBlur={handleApiKeyBlur}
                onChange={(e) => setCurrentKey(e.target.value)}
                placeholder="sk-xxxxxxxx..."
                className={selectClasses}
              />
              <p className="text-xs text-muted-foreground">
                {currentMaskedKey && !isApiKeyEditing
                  ? "已配置密钥，点击输入框可重新填写"
                  : `从 ${provider} 获取 Key：${providerHint}`}
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
