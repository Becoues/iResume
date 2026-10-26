"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  KeyRound,
  Save,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AiProvider, AiSettings } from "@/lib/prep-contract";
import { apiJson, ErrorNotice, Spinner } from "@/components/prep/shared";
import { switchProviderDraft } from "@/components/prep/settings-draft";
const initial: AiSettings = {
  provider: "CometAPI",
  model: "",
  baseUrl: "https://api.cometapi.com/v1",
  region: "us-west-2",
  authMode: "default",
  apiKey: "",
  bedrockApiKey: "",
};
export default function SettingsPage() {
  const [settings, setSettings] = useState<AiSettings>(initial);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const bedrockModel = settings.model.trim();
  const usesBedrockMantle = bedrockModel.startsWith("openai.");
  const bedrockMantleEndpoint = `https://bedrock-mantle.${settings.region.trim() || "us-west-2"}.api.aws${bedrockModel.startsWith("openai.gpt-oss") ? "/v1" : "/openai/v1"}/responses`;
  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson<AiSettings>("/api/settings");
      setSettings({ ...initial, ...data, apiKey: "", bedrockApiKey: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载设置。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function update<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setMessage("");
    setSaved(false);
  }
  function selectProvider(provider: AiProvider) {
    setSettings((draft) => switchProviderDraft(draft, provider));
    setMessage("");
    setSaved(false);
  }
  async function action(kind: "save" | "test") {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      const data = await apiJson<
        AiSettings & { success?: boolean; message?: string; error?: string }
      >(kind === "save" ? "/api/settings" : "/api/settings/test-connection", {
        method: kind === "save" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (data.success === false)
        throw new Error(
          data.error || data.message || "连接测试未通过，请检查配置。",
        );
      if (kind === "save") {
        setSettings({ ...initial, ...data, apiKey: "", bedrockApiKey: "" });
        setSaved(true);
        setMessage("配置已保存。现在可以开始准备面试。");
      } else
        setMessage(
          data.message || "连接成功，模型可以正常响应。测试不会保存配置。",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div className="eyebrow">MAKE IT YOUR WORKSPACE</div>
        <h1>
          连接你的 AI 模型<span className="blue-period">.</span>
        </h1>
        <p>选择模型服务，完成一次配置，就可以开始每一场面试前的准备。</p>
      </div>
      {loading ? (
        <div className="panel empty-state">
          <Spinner label="正在读取配置…" />
        </div>
      ) : (
        <div className="settings-grid">
          <form
            className="panel settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action("save");
            }}
          >
            <div className="panel-title">
              <span className="section-icon">
                <Server size={19} />
              </span>
              <div>
                <h2>模型服务</h2>
                <p>所有生成请求通过服务器发送</p>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="provider">服务提供方</label>
              <select
                id="provider"
                value={settings.provider}
                onChange={(e) => selectProvider(e.target.value as AiProvider)}
                disabled={Boolean(busy)}
              >
                <option value="CometAPI">CometAPI</option>
                <option value="OpenAI-compatible">OpenAI 兼容接口</option>
                <option value="Bedrock">Amazon Bedrock</option>
              </select>
            </div>
            {settings.provider !== "Bedrock" ? (
              <>
                <div className="form-field">
                  <label htmlFor="base-url">API 地址</label>
                  <input
                    id="base-url"
                    type="url"
                    value={settings.baseUrl}
                    onChange={(e) => update("baseUrl", e.target.value)}
                    placeholder="https://api.example.com/v1"
                    required
                    disabled={Boolean(busy)}
                  />
                  <small>使用服务商提供的 OpenAI 兼容接口地址。</small>
                </div>
                <div className="form-field">
                  <label htmlFor="api-key">
                    API Key{" "}
                    {settings.hasApiKey && (
                      <span className="saved-key">
                        <Check size={12} /> 已保存
                      </span>
                    )}
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    autoComplete="new-password"
                    value={settings.apiKey || ""}
                    onChange={(e) => update("apiKey", e.target.value)}
                    placeholder={
                      settings.hasApiKey
                        ? "已安全保存，留空保持不变"
                        : "输入服务商提供的 API Key"
                    }
                    disabled={Boolean(busy)}
                  />
                  <small>密钥仅保存于服务器，不会在页面中回显。</small>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label htmlFor="region">AWS Region</label>
                  <input
                    id="region"
                    value={settings.region}
                    onChange={(e) => update("region", e.target.value)}
                    placeholder="us-west-2"
                    required
                    disabled={Boolean(busy)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="auth-mode">认证方式</label>
                  <select
                    id="auth-mode"
                    value={settings.authMode}
                    onChange={(e) =>
                      update("authMode", e.target.value as "default" | "apiKey")
                    }
                    disabled={Boolean(busy)}
                  >
                    <option value="default">
                      服务器默认 AWS 凭据 / IAM 角色
                    </option>
                    <option value="apiKey">Bedrock API Key</option>
                  </select>
                </div>
                {settings.authMode === "apiKey" && (
                  <div className="form-field">
                    <label htmlFor="bedrock-key">
                      Bedrock API Key{" "}
                      {settings.hasBedrockApiKey && (
                        <span className="saved-key">
                          <Check size={12} /> 已保存
                        </span>
                      )}
                    </label>
                    <input
                      id="bedrock-key"
                      type="password"
                      autoComplete="new-password"
                      value={settings.bedrockApiKey || ""}
                      onChange={(e) => update("bedrockApiKey", e.target.value)}
                      placeholder={
                        settings.hasBedrockApiKey
                          ? "已安全保存，留空保持不变"
                          : "输入 Bedrock API Key"
                      }
                      disabled={Boolean(busy)}
                    />
                  </div>
                )}
              </>
            )}
            <div className="form-field">
              <label htmlFor="model">模型 ID</label>
              <input
                id="model"
                value={settings.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder={
                  settings.provider === "Bedrock"
                    ? "模型 ID 或 inference profile ID / ARN"
                    : "填写服务商支持的模型 ID"
                }
                required
                disabled={Boolean(busy)}
              />
              <small>
                {settings.provider === "Bedrock" ? (
                  usesBedrockMantle ? (
                    <>
                      已自动使用 Bedrock Mantle / Responses API
                      <br />
                      {bedrockMantleEndpoint}
                      {settings.authMode === "default" && (
                        <>
                          <br />
                          该模型 ID 需使用 Bedrock API Key；使用默认 AWS
                          凭据时，请改填 inference profile ID / ARN。
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      使用 Bedrock Runtime / Converse API。请确认模型在所选 Region
                      可用，且服务器有调用权限；需要跨区域推理时，请填写 inference
                      profile ID / ARN。
                    </>
                  )
                ) : (
                  "请填写准确的模型名称，并确认账户有调用权限。"
                )}
              </small>
            </div>
            {error && <ErrorNotice>{error}</ErrorNotice>}
            {message && (
              <div className="notice success" role="status">
                <CircleCheck size={18} />
                <span>{message}</span>
              </div>
            )}
            <div className="settings-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => action("test")}
                disabled={Boolean(busy) || !settings.model}
              >
                {busy === "test" ? (
                  <Spinner label="测试中…" />
                ) : (
                  <>
                    <Zap size={16} /> 测试连接
                  </>
                )}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={Boolean(busy)}
              >
                {busy === "save" ? (
                  <Spinner label="保存中…" />
                ) : (
                  <>
                    <Save size={16} /> 保存配置
                  </>
                )}
              </button>
            </div>
            {saved && (
              <Link href="/" className="after-save-link">
                开始准备面试 <ArrowRight size={15} />
              </Link>
            )}
          </form>
          <aside className="settings-aside">
            <span className="settings-shield">
              <KeyRound size={25} />
            </span>
            <h2>
              你的模型，
              <br />
              你的准备方式。
            </h2>
            <p>支持聚合服务、OpenAI 兼容接口，以及使用 AWS 凭据的 Bedrock。</p>
            <div className="aside-divider" />
            <h3>
              <ShieldCheck size={17} /> 凭据安全保存在服务器
            </h3>
            <p>
              更换模型时，已保存的密钥可以留空。测试连接会发起一次真实的模型请求。
            </p>
            <p>简历和岗位描述会发送给你选择的模型服务，用于生成面试简报。</p>
            <Link href="/" className="back-link">
              <ArrowLeft size={15} /> 返回面试准备
            </Link>
          </aside>
        </div>
      )}
      {!loading && error && !settings.model && (
        <button className="text-button" onClick={load}>
          重新读取配置
        </button>
      )}
    </div>
  );
}
