"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { successfulBriefRun } from "@/components/prep/brief-result";
import { BriefOutline, BriefSection } from "@/components/prep/brief-outline";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { PrepQuestion, PrepResume } from "@/lib/prep-contract";
import {
  apiJson,
  ErrorNotice,
  Evidence,
  formatDate,
  Spinner,
} from "@/components/prep/shared";

function QuestionCard({ item, index }: { item: PrepQuestion; index: number }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${item.question}\n\n为什么问：${item.purpose}\n重点听：${item.listenFor.join("；")}\n追问：${item.followUps.join("；")}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("复制失败，请选中问题文本手动复制。");
    }
  }
  return (
    <article className="question-card" id={`question-${index + 1}`}>
      <div className="question-number">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="question-body">
        {(item.priority || item.dimension || index < 2) && (
          <div className="question-labels">
            {item.priority && (
              <span className={`priority-badge priority-${item.priority}`}>
                {item.priority === "high" ? "优先必问" : "延伸了解"}
              </span>
            )}
            {!item.priority && index < 2 && <span className="priority-badge priority-high">建议先问</span>}
            {item.dimension && <span className="dimension-badge">{item.dimension}</span>}
          </div>
        )}
        <div className="question-title">
          <h3>{item.question}</h3>
          <button
            className="icon-button no-print"
            onClick={copy}
            title="复制问题"
            aria-label="复制问题"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="question-purpose">
          <span>为什么问</span>
          {item.purpose}
        </p>
        <Evidence evidence={item.evidence} />
        <details className="question-expansion" open>
          <summary>
            <span>重点听什么 & 如何追问</span>
            <ChevronDown size={15} />
          </summary>
          <div className="question-guidance">
            <div>
              <h4>重点听什么</h4>
              <ul>
                {item.listenFor.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>可以这样追问</h4>
              <ul>
                {item.followUps.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

export default function ResumeDetailPage() {
  const params = useParams<{ id: string }>();
  const [resume, setResume] = useState<PrepResume | null>(null);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    try {
      const data = await apiJson<PrepResume>(`/api/resumes/${params.id}`);
      setResume(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载候选人信息。");
    }
  }, [params.id]);
  useEffect(() => {
    void load();
    try {
      setWarnings(
        JSON.parse(
          sessionStorage.getItem(`prep-warnings-${params.id}`) || "[]",
        ),
      );
      const startError = sessionStorage.getItem(
        `prep-start-error-${params.id}`,
      );
      if (startError) {
        setWarnings((old) => [...old, startError]);
        sessionStorage.removeItem(`prep-start-error-${params.id}`);
      }
    } catch {}
  }, [load, params.id]);
  useEffect(() => {
    if (resume?.briefStatus !== "running") return;
    const timer = setInterval(() => {
      void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [resume?.briefStatus, load]);
  useEffect(() => {
    if (sourceOpen) sourceDialog.current?.showModal();
    else if (sourceDialog.current?.open) {
      sourceDialog.current.close();
      sourceTrigger.current?.focus();
    }
  }, [sourceOpen]);
  async function generate(mode: "quick" | "deep") {
    setRequesting(true);
    setError("");
    try {
      await apiJson(`/api/briefs/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请重试。");
    } finally {
      setRequesting(false);
    }
  }
  function print() {
    const details = Array.from(document.querySelectorAll("details"));
    const opened = details.map((el) => el.open);
    details.forEach((el) => {
      el.open = true;
    });
    const restore = () => {
      details.forEach((el, i) => {
        el.open = opened[i];
      });
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  const busy = requesting || resume?.briefStatus === "running";
  const brief = resume?.brief;
  const resultRun = resume ? successfulBriefRun(resume) : null;
  const sections: BriefSection[] = brief ? [
    { id: "overview", title: "候选人概览" },
    ...(brief.highlights?.length ? [{ id: "highlights", title: "面试重点", count: brief.highlights.length }] : []),
    ...(brief.experiences.length ? [{ id: "experience", title: "关键经历", count: brief.experiences.length }] : []),
    ...(brief.capabilities?.length ? [{ id: "capabilities", title: "能力观察", count: brief.capabilities.length }] : []),
    ...(brief.questions.length ? [{
      id: "questions", title: "面试问题", count: brief.questions.length,
      children: brief.questions.map((item, index) => ({ id: `question-${index + 1}`, title: item.question })),
    }] : []),
    ...(brief.verificationPoints.length ? [{ id: "verification", title: "待核实事项", count: brief.verificationPoints.length }] : []),
    ...(brief.uncertainties.length ? [{ id: "gaps", title: "信息边界", count: brief.uncertainties.length }] : []),
  ] : [];
  return (
    <div className="page detail-page">
      <div className="detail-toolbar no-print">
        <Link href="/resumes" className="back-link">
          <ArrowLeft size={16} /> 我的简报
        </Link>
        <div className="button-group">
          <button
            ref={sourceTrigger}
            className="button secondary"
            onClick={() => setSourceOpen(true)}
            disabled={!resume}
          >
            <FileText size={16} /> 查看原文
          </button>
          {brief && (
            <button className="button secondary" onClick={print}>
              <Printer size={16} /> 打印简报
            </button>
          )}
        </div>
      </div>
      {error && (
        <ErrorNotice>
          {error}{" "}
          <button className="text-button" onClick={load}>
            重新加载
          </button>{" "}
          <Link href="/settings">检查模型设置</Link>
        </ErrorNotice>
      )}
      {!resume && !error && (
        <div className="panel empty-state">
          <Spinner label="正在打开候选人简报…" />
        </div>
      )}
      {warnings.length > 0 && (
        <div className="notice warning no-print">
          <FileText size={17} />
          <div>
            {warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setWarnings([])}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {busy && (
        <div className="notice progress-notice" role="status">
          <Spinner
            label={
              brief
                ? "正在深入准备，已有简报仍可阅读…"
                : "正在梳理经历与原文依据，生成你的面试简报…"
            }
          />
          <span>可以离开此页，稍后回来查看</span>
        </div>
      )}
      {resume?.briefStatus === "failed" && (
        <ErrorNotice>
          {resume.briefError || "这次生成未完成，请重试。"}
          {brief && <p>上一次成功生成的简报已保留。</p>}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              generate(resume.briefRun?.mode === "deep" ? "deep" : "quick")
            }
          >
            重新生成
          </button>{" "}
          <Link href="/settings">检查模型设置</Link>
        </ErrorNotice>
      )}
      {resume && !brief && (
        <section className="panel empty-state brief-empty">
          <span className="empty-icon">
            <BookOpen size={32} />
          </span>
          <div className="eyebrow">YOUR NEXT CONVERSATION STARTS HERE</div>
          <h1>{busy ? "正在为你准备好问题" : "简历已就绪，开始准备"}</h1>
          <p className="file-name">{resume.filename}</p>
          <p>先了解候选人的经历主线，再聚焦值得核实的细节。</p>
          <div className="preparation-steps">
            <span>
              <Check size={15} /> 简历已提取
            </span>
            <span>
              {busy ? <Spinner label="" /> : <Target size={15} />} 梳理关键经历
            </span>
            <span>
              <Sparkles size={15} /> 生成优先问题
            </span>
          </div>
          {!busy && (
            <button
              className="button primary"
              onClick={() => generate("quick")}
            >
              <Sparkles size={17} /> 生成面试简报 <ArrowRight size={17} />
            </button>
          )}
        </section>
      )}
      {brief && resume && (
        <>
          <section className="candidate-header">
            <div>
              <div className="eyebrow">
                CANDIDATE BRIEFING{" "}
                <span className="brief-version">
                  {resultRun?.mode === "deep"
                    ? "深入准备"
                    : resultRun
                      ? "快速简报"
                      : "已保存简报"}
                </span>
              </div>
              <h1>{brief.candidate.name || "候选人"}</h1>
              <p className="candidate-headline">{brief.candidate.headline}</p>
              <div className="candidate-meta">
                <span>{brief.candidate.experience}</span>
                <span>
                  {resultRun?.completedAt
                    ? `准备于 ${formatDate(resultRun.completedAt)}`
                    : "生成时间未记录"}
                </span>
              </div>
            </div>
            <div className="candidate-stamp">
              <BookOpen size={27} />
              <span>
                面试前
                <br />
                阅读简报
              </span>
            </div>
          </section>
          <div className="brief-layout">
            <div className="brief-main">
              <section className="panel briefing-section overview-section" id="overview">
                <div className="section-heading">
                  <span className="section-icon">
                    <FileText size={18} />
                  </span>
                  <h2>候选人概览</h2>
                </div>
                <p className="brief-summary">{brief.summary}</p>
                <div className="brief-at-a-glance" aria-label="简报内容概览">
                  {brief.experiences.length > 0 && (
                    <a href="#experience"><strong>{brief.experiences.length}</strong><span>段关键经历</span></a>
                  )}
                  {brief.questions.length > 0 && (
                    <a href="#questions"><strong>{brief.questions.length}</strong><span>个面试问题</span></a>
                  )}
                  {brief.verificationPoints.length > 0 && (
                    <a href="#verification"><strong>{brief.verificationPoints.length}</strong><span>项待核实</span></a>
                  )}
                </div>
                <div className="skill-tags">
                  {brief.candidate.skills.map((skill, i) => (
                    <span key={i}>{skill}</span>
                  ))}
                </div>
                {brief.fitSummary && (
                  <div className="fit-summary">
                    <span>
                      {resume.jdText ? "与岗位的关联" : "本次面试关注点"}
                    </span>
                    <p>{brief.fitSummary}</p>
                  </div>
                )}
              </section>
              {!!brief.highlights?.length && (
                <section className="panel briefing-section" id="highlights">
                  <div className="section-heading">
                    <span className="section-icon"><Target size={18} /></span>
                    <h2>这次面试，重点看什么</h2>
                    <span className="section-count">{brief.highlights.length}</span>
                  </div>
                  <div className="highlight-grid">
                    {brief.highlights.map((item, index) => (
                      <article className="highlight-card" key={index}>
                        <span className="highlight-label">重点 {String(index + 1).padStart(2, "0")}</span>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                        <Evidence evidence={item.evidence} />
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {brief.experiences.length > 0 && (
              <section className="panel briefing-section" id="experience">
                <div className="section-heading">
                  <span className="section-icon">
                    <Target size={18} />
                  </span>
                  <h2>值得展开的经历</h2>
                  <span className="section-count">
                    {brief.experiences.length}
                  </span>
                </div>
                <div className="experience-list">
                  {brief.experiences.map((item, i) => (
                    <article key={i}>
                      <span className="experience-dot" />
                      <h3>{item.title}</h3>
                      <p>{item.relevance}</p>
                      <dl className="experience-details">
                        {item.contribution && <div><dt>职责与贡献</dt><dd>{item.contribution}</dd></div>}
                        {item.challenge && <div><dt>关键挑战</dt><dd>{item.challenge}</dd></div>}
                        {item.approach && <div><dt>做法与取舍</dt><dd>{item.approach}</dd></div>}
                        {item.results && <div><dt>结果与影响</dt><dd>{item.results}</dd></div>}
                      </dl>
                      <Evidence evidence={item.evidence} />
                    </article>
                  ))}
                </div>
              </section>
              )}
              {!!brief.capabilities?.length && (
                <section className="panel briefing-section" id="capabilities">
                  <div className="section-heading">
                    <span className="section-icon"><Target size={18} /></span>
                    <h2>能力观察与验证方向</h2>
                    <span className="section-count">{brief.capabilities.length}</span>
                  </div>
                  <p className="section-subtitle">区分简历中的线索与面试中需要验证的能力。</p>
                  <div className="capability-list">
                    {brief.capabilities.map((item, index) => (
                      <article className="capability-card" key={index}>
                        <h3>{item.dimension}</h3>
                        <dl>
                          <div><dt>简历观察</dt><dd>{item.observation}</dd></div>
                          <div><dt>面试验证</dt><dd>{item.verification}</dd></div>
                        </dl>
                        <Evidence evidence={item.evidence} />
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {brief.questions.length > 0 && (
              <section
                className="panel briefing-section questions-section"
                id="questions"
              >
                <div className="section-heading">
                  <span className="section-icon">
                    <Sparkles size={18} />
                  </span>
                  <h2>优先问这几个问题</h2>
                  <span className="section-count">
                    {brief.questions.length}
                  </span>
                </div>
                <p className="section-subtitle">
                  从具体经历切入，把对话带到真实的思考与行动。
                </p>
                {brief.questions.map((question, i) => (
                  <QuestionCard
                    item={question}
                    index={i}
                    key={`${question.id}-${i}`}
                  />
                ))}
              </section>
              )}
              {brief.verificationPoints.length > 0 && (
                <section className="panel briefing-section verification-section" id="verification">
                  <div className="section-heading">
                    <span className="section-icon"><BookOpen size={18} /></span>
                    <h2>带着这些疑问去聊</h2>
                    <span className="section-count">{brief.verificationPoints.length}</span>
                  </div>
                  <p className="section-subtitle">以下是需要确认的线索，并非对候选人的结论。</p>
                  <div className="verification-list">
                    {brief.verificationPoints.map((item, index) => (
                      <article key={index}>
                        <span className="verification-index">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.reason}</p>
                          <Evidence evidence={item.evidence} />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {brief.uncertainties.length > 0 && (
                <section className="panel briefing-section gaps-section" id="gaps">
                  <div className="section-heading">
                    <span className="section-icon"><FileText size={18} /></span>
                    <h2>信息边界</h2>
                    <span className="section-count">{brief.uncertainties.length}</span>
                  </div>
                  <ul className="gap-list">
                    {brief.uncertainties.map((text, index) => <li key={index}>{text}</li>)}
                  </ul>
                </section>
              )}
              <div className="deep-prep no-print">
                <div>
                  <h3>还想准备得更深入？</h3>
                  <p>围绕项目细节和待核实点，补充更具体的提问。</p>
                  {!brief.highlights?.length && !brief.capabilities?.length && (
                    <p>这是已保存的简报，重新生成可获取更完整的经历拆解与能力观察。</p>
                  )}
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => generate("deep")}
                >
                  {busy ? (
                    <Spinner label="准备中" />
                  ) : (
                    <>
                      <Sparkles size={17} /> 深入准备
                    </>
                  )}
                </button>
              </div>
              <p className="ai-note">
                简报由 AI
                辅助整理，请结合原文判断。它帮助你提出问题，不替你作出录用决定。
              </p>
              <button
                className="text-button no-print"
                disabled={busy}
                onClick={() => generate("quick")}
              >
                <RefreshCw size={14} /> 重新生成快速简报
              </button>
            </div>
            <BriefOutline sections={sections} />
          </div>
        </>
      )}
      <dialog
        ref={sourceDialog}
        className="source-dialog"
        onCancel={() => setSourceOpen(false)}
        onClose={() => setSourceOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSourceOpen(false);
        }}
        aria-labelledby="source-title"
      >
        <div className="source-content">
          <div className="source-header">
            <div>
              <span className="small-eyebrow">SOURCE MATERIAL</span>
              <h2 id="source-title">简历原文</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setSourceOpen(false)}
              aria-label="关闭原文"
            >
              <X size={22} />
            </button>
          </div>
          <p className="muted file-name">{resume?.filename}</p>
          <div className="notice source-note">
            以下为提取的文本。图片、扫描件及复杂排版可能产生识别误差。
          </div>
          <pre>{resume?.pdfText}</pre>
          {resume?.jdText && (
            <>
              <h3>岗位描述</h3>
              <pre>{resume.jdText}</pre>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
