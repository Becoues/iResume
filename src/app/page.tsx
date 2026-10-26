"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileText,
  ListChecks,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AiSettings } from "@/lib/prep-contract";
import { apiJson, ErrorNotice, Spinner } from "@/components/prep/shared";

export default function HomePage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [jd, setJd] = useState("");
  const [showJd, setShowJd] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    apiJson<AiSettings>("/api/settings")
      .then((s) => setConfigured(Boolean(s.configured)))
      .catch(() => {});
  }, []);
  function chooseFile(next: File | null) {
    setError("");
    if (next && !/\.(pdf|docx?|txt|md|rtf|png|jpe?g|webp)$/i.test(next.name)) {
      setError("请选择 PDF、Word、文本文件或 PNG / JPG / WebP 图片。");
      return;
    }
    if (next && next.size > 10 * 1024 * 1024) {
      setError("文件大小不能超过 10 MB，请压缩后重试。");
      return;
    }
    setFile(next);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setStage("正在提取简历内容…");
    try {
      let options: RequestInit;
      if (tab === "file" && file) {
        const body = new FormData();
        body.append("file", file);
        if (jd.trim()) body.append("jd", jd);
        options = { method: "POST", body };
      } else
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, filename: "粘贴的简历.txt", jd }),
        };
      const result = await apiJson<{ id: string; warnings?: string[] }>(
        "/api/resumes",
        options,
      );
      if (result.warnings?.length) {
        try {
          sessionStorage.setItem(
            `prep-warnings-${result.id}`,
            JSON.stringify(result.warnings),
          );
        } catch {}
      }
      setStage("正在创建面试简报…");
      try {
        await apiJson(`/api/briefs/${result.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "quick" }),
        });
      } catch (err) {
        try {
          sessionStorage.setItem(
            `prep-start-error-${result.id}`,
            err instanceof Error ? err.message : "生成未启动，请重试。",
          );
        } catch {}
      }
      router.push(`/resumes/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试。");
      setBusy(false);
    }
  }
  return (
    <div className="page home-page">
      <div className="page-heading">
        <div className="eyebrow">
          <span /> READY FOR YOUR NEXT INTERVIEW
        </div>
        <h1>
          好面试，从充分准备开始<span className="blue-period">.</span>
        </h1>
        <p>放入一份简历，把有限的准备时间留给真正值得问的问题。</p>
      </div>
      {configured === false && (
        <div className="notice config-notice">
          <Sparkles size={18} />
          <div>
            首次使用，请先连接你的 AI 模型。
            <Link href="/settings">
              前往模型设置 <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
      <div className="home-grid">
        <section className="panel input-panel">
          <div className="panel-title">
            <span className="step-number">01</span>
            <div>
              <h2>添加候选人简历</h2>
              <p>一份简历，一次有重点的准备</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <div
              className="input-tabs"
              role="tablist"
              aria-label="简历输入方式"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "file"}
                aria-controls="resume-input"
                onClick={() => setTab("file")}
                className={tab === "file" ? "selected" : ""}
              >
                <UploadCloud size={16} /> 上传文件
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "text"}
                aria-controls="resume-input"
                onClick={() => setTab("text")}
                className={tab === "text" ? "selected" : ""}
              >
                <FileText size={16} /> 粘贴文本
              </button>
            </div>
            <div id="resume-input" role="tabpanel">
              {tab === "file" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (!busy) chooseFile(e.dataTransfer.files[0] || null);
                  }}
                  className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                >
                  <input
                    ref={input}
                    type="file"
                    id="resume-file"
                    className="sr-only"
                    accept=".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                    disabled={busy}
                  />
                  {file ? (
                    <>
                      <div className="upload-symbol">
                        <FileText size={28} />
                      </div>
                      <strong className="file-name">{file.name}</strong>
                      <span className="muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · 已选择
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          chooseFile(null);
                          if (input.current) input.current.value = "";
                        }}
                      >
                        <X size={14} /> 移除文件
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="upload-symbol">
                        <UploadCloud size={28} strokeWidth={1.6} />
                      </div>
                      <strong>将简历拖到这里</strong>
                      <span className="muted">或从你的设备中选择文件</span>
                      <button
                        type="button"
                        className="button secondary choose-file"
                        onClick={() => input.current?.click()}
                        disabled={busy}
                      >
                        选择简历 <Plus size={15} />
                      </button>
                      <span className="file-formats">
                        PDF · DOC / DOCX · TXT / MD / RTF · 图片 · 最大 10 MB
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="paste-input">
                  <label htmlFor="resume-text" className="sr-only">
                    简历正文
                  </label>
                  <textarea
                    id="resume-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={busy}
                    placeholder="将候选人的简历正文粘贴到这里，保留项目经历、职责与成果等信息…"
                    rows={10}
                    required
                  />
                  <span className="char-count">
                    {text.length.toLocaleString()} 字符
                  </span>
                </div>
              )}
            </div>
            <p className="input-hint">
              <ShieldCheck size={14} />{" "}
              图片和扫描件会进行文字识别，请核对提取后的原文。
            </p>
            <div className="jd-section">
              <button
                type="button"
                className="jd-toggle"
                aria-expanded={showJd}
                aria-controls="jd-field"
                onClick={() => setShowJd(!showJd)}
              >
                <span>
                  <span className="step-number small">02</span> 添加岗位描述{" "}
                  <span className="optional">可选</span>
                </span>
                <Plus size={17} className={showJd ? "rotate" : ""} />
              </button>
              {showJd && (
                <div id="jd-field">
                  <p className="muted">
                    加上岗位职责和要求，让问题更贴近你正在招聘的角色。
                  </p>
                  <label htmlFor="jd-text" className="sr-only">
                    岗位描述
                  </label>
                  <textarea
                    id="jd-text"
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    disabled={busy}
                    placeholder="粘贴岗位描述，或写下这次面试最想了解的能力…"
                    rows={5}
                  />
                </div>
              )}
            </div>
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <button
              type="submit"
              className="button primary generate-button"
              disabled={busy || (tab === "file" ? !file : !text.trim())}
            >
              {busy ? (
                <Spinner label={stage} />
              ) : (
                <>
                  <Sparkles size={17} /> 生成面试简报 <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="submit-note">先看关键经历，再带着依据提问。</p>
          </form>
        </section>
        <aside className="prep-preview">
          <div className="preview-header">
            <span className="small-eyebrow">YOUR PREPARATION, SIMPLIFIED</span>
            <span className="preview-mini-mark">
              <Sparkles size={17} />
            </span>
          </div>
          <h2>
            一份简报，
            <br />
            三个准备重点。
          </h2>
          <p className="preview-intro">
            把简历里的信息，转化为下一场对话的起点。
          </p>
          <div className="preview-items">
            <div>
              <span className="preview-icon">
                <FileText size={20} />
              </span>
              <section>
                <h3>快速认识候选人</h3>
                <p>
                  梳理经历主线、能力线索
                  <br />
                  与最相关的项目。
                </p>
              </section>
            </div>
            <div>
              <span className="preview-icon">
                <ListChecks size={20} />
              </span>
              <section>
                <h3>找到值得核实的细节</h3>
                <p>
                  区分简历事实与待验证判断，
                  <br />
                  回到原文查看依据。
                </p>
              </section>
            </div>
            <div>
              <span className="preview-icon">
                <MessageSquareText size={20} />
              </span>
              <section>
                <h3>带走 3—5 个好问题</h3>
                <p>
                  知道为什么问、重点听什么，
                  <br />
                  以及如何继续追问。
                </p>
              </section>
            </div>
          </div>
          <div className="preview-bottom">
            <Check size={15} /> 保留原文依据 <span /> 随时打印简报
          </div>
        </aside>
      </div>
    </div>
  );
}
