"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Trash2,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResumeListItem {
  id: string;
  filename: string;
  uploadDate: string;
  updatedAt: string;
  status: string;
  scoreCard?: {
    finalScore: number | null;
    architectureTotal: number | null;
    dnaTotal: number | null;
  } | null;
  candidateName?: string | null;
  techDirection?: string | null;
  experienceYears?: string | null;
  levelMatch?: string | null;
  recommendation?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(raw: string): string {
  const d = new Date(raw);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

function getRecommendationStyle(rec: string | null): { label: string; className: string } | null {
  if (!rec) return null;
  const map: Record<string, { label: string; className: string }> = {
    strong_recommend: {
      label: "强烈推荐",
      className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20",
    },
    recommend: {
      label: "推荐",
      className: "bg-green-50 text-green-700 ring-1 ring-green-600/20",
    },
    cautious_recommend: {
      label: "谨慎推荐",
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    },
    conditional: {
      label: "有条件推荐",
      className: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20",
    },
    not_recommend: {
      label: "不推荐",
      className: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
    },
  };
  return map[rec] || { label: rec, className: "bg-gray-50 text-gray-700 ring-1 ring-gray-500/20" };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "analyzing":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20">
          <Loader2 className="h-3 w-3 animate-spin" />
          分析中
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
          <CheckCircle2 className="h-3 w-3" />
          已完成
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">
          <AlertCircle className="h-3 w-3" />
          失败
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-500/20">
          已上传
        </span>
      );
  }
}

function ScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-[72px] w-[72px] items-center justify-center shrink-0">
      <svg className="-rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          className="stroke-gray-100"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          className={`${getScoreRingColor(score)} transition-all duration-700`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={`absolute text-lg font-bold ${getScoreColor(score)}`}
      >
        {score}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="h-8 w-24 rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100">
        <FileText className="h-8 w-8 text-violet-500" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-foreground">
        还没有简历记录
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        上传你的第一份简历，开始智能分析之旅。AI 将从多个维度为你的简历打分并给出改进建议。
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      >
        上传简历
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
      <p className="flex-1 text-sm text-red-700">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        重试
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchResumes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resumes");
      if (!res.ok) throw new Error("请求失败，请稍后重试");
      const data: ResumeListItem[] = await res.json();
      setResumes(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "未知错误，请稍后重试"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleDelete = async (id: string, filename: string) => {
    const confirmed = window.confirm(
      `确定要删除「${filename}」吗？此操作不可撤销。`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            历史记录
          </h1>
          {!loading && !error && (
            <p className="mt-1 text-sm text-muted-foreground">
              共 {resumes.length} 份简历
            </p>
          )}
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          上传简历
        </Link>
      </div>

      {/* Error state */}
      {error && <ErrorBanner message={error} onRetry={fetchResumes} />}

      {/* Loading state */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && resumes.length === 0 && <EmptyState />}

      {/* Resume list */}
      {!loading && resumes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {resumes.map((resume) => {
            const isDeleting = deletingId === resume.id;
            const score = resume.scoreCard?.finalScore ?? null;
            const archTotal = resume.scoreCard?.architectureTotal ?? null;
            const dnaTotal = resume.scoreCard?.dnaTotal ?? null;
            const isCompleted = resume.status === "completed";
            const recStyle = isCompleted && resume.recommendation
              ? getRecommendationStyle(resume.recommendation)
              : score !== null
                ? getRecommendationStyle(score >= 80 ? "strong_recommend" : score >= 60 ? "recommend" : "not_recommend")
                : null;

            return (
              <div
                key={resume.id}
                className={`group relative rounded-xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-md ${
                  isDeleting ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <Link
                  href={`/resumes/${resume.id}`}
                  className="block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                >
                  {/* Row 1: info + status badge top-right */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isCompleted && resume.candidateName ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white font-bold text-sm">
                          {resume.candidateName.slice(0, 1)}
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-blue-50">
                          <FileText className="h-5 w-5 text-violet-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {isCompleted && resume.candidateName ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-foreground">
                                {resume.candidateName}
                              </p>
                              {resume.levelMatch && (
                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-indigo-500/20">
                                  {resume.levelMatch}
                                </span>
                              )}
                            </div>
                            {resume.techDirection && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {resume.techDirection}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-foreground break-all">
                            {resume.filename}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>上传 {formatDate(resume.uploadDate)}</span>
                          {isCompleted && resume.updatedAt && (
                            <span>· 分析于 {formatDate(resume.updatedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={resume.status} />
                  </div>

                  {/* Row 2: score ring + details + arrow */}
                  <div className="mt-4 flex items-center justify-between">
                    {isCompleted && score !== null ? (
                      <div className="flex items-center gap-3">
                        <ScoreRing score={score} />
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BarChart3 className="h-3 w-3" />
                            综合评分
                          </div>
                          {recStyle && (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${recStyle.className}`}
                            >
                              {recStyle.label}
                            </span>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {archTotal !== null && (
                              <span>
                                架构{" "}
                                <strong className="text-foreground font-semibold">{archTotal}</strong>
                                <span className="text-muted-foreground/60">/20</span>
                              </span>
                            )}
                            {dnaTotal !== null && (
                              <span>
                                DNA{" "}
                                <strong className="text-foreground font-semibold">{dnaTotal}</strong>
                                <span className="text-muted-foreground/60">/30</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-violet-600">
                      查看详情
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(resume.id, resume.filename);
                  }}
                  disabled={isDeleting}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100"
                  aria-label={`删除 ${resume.filename}`}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
