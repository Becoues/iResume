"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  FileText,
  Trash2,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPinyinVariants } from "@/lib/pinyin";

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
  tag?: string | null;
}

type TagFilter = "all" | "校招" | "实习" | "社招" | "untagged";
const TAG_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "校招", label: "校招", className: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20" },
  { value: "实习", label: "实习", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20" },
  { value: "社招", label: "社招", className: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20" },
];

type StatusFilter = "all" | "uploaded" | "analyzing" | "completed" | "failed";
type RecommendationFilter =
  | "all"
  | "strong_recommend"
  | "recommend"
  | "cautious_recommend"
  | "conditional"
  | "not_recommend";
type SortOption =
  | "upload-desc"
  | "upload-asc"
  | "updated-desc"
  | "updated-asc"
  | "score-desc"
  | "score-asc"
  | "name-asc"
  | "name-desc";

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

function getResumeSearchText(resume: ResumeListItem): string {
  const base = [
    resume.candidateName,
    resume.filename,
    resume.techDirection,
    resume.experienceYears,
    resume.levelMatch,
    resume.recommendation,
    getRecommendationStyle(resume.recommendation ?? null)?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Add pinyin variants for candidate name
  const pinyinParts = resume.candidateName
    ? getPinyinVariants(resume.candidateName)
    : [];

  return [base, ...pinyinParts].join(" ");
}

function getResumeDisplayName(resume: ResumeListItem): string {
  return (resume.candidateName || resume.filename).trim().toLowerCase();
}

function getResumeScore(resume: ResumeListItem): number {
  return resume.scoreCard?.finalScore ?? -1;
}

function getRecommendationLabel(value: RecommendationFilter | "all"): string {
  if (value === "all") return "全部推荐结论";
  return getRecommendationStyle(value)?.label ?? value;
}

function getStatusLabel(value: StatusFilter): string {
  const map: Record<StatusFilter, string> = {
    all: "全部状态",
    uploaded: "已上传",
    analyzing: "分析中",
    completed: "已完成",
    failed: "失败",
  };
  return map[value];
}

function matchesRecommendation(
  resume: ResumeListItem,
  recommendationFilter: RecommendationFilter
): boolean {
  if (recommendationFilter === "all") return true;
  return resume.recommendation === recommendationFilter;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [recommendationFilter, setRecommendationFilter] =
    useState<RecommendationFilter>("all");
  const [techFilter, setTechFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("upload-desc");

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

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const techOptions = Array.from(
    new Set(
      resumes
        .map((resume) => resume.techDirection?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));

  const filteredResumes = resumes.filter((resume) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      getResumeSearchText(resume).includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "all" || resume.status === statusFilter;
    const matchesTech =
      techFilter === "all" || resume.techDirection?.trim() === techFilter;
    const matchesTag =
      tagFilter === "all" ||
      (tagFilter === "untagged" ? !resume.tag : resume.tag === tagFilter);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesRecommendation(resume, recommendationFilter) &&
      matchesTech &&
      matchesTag
    );
  });

  const sortedResumes = [...filteredResumes].sort((a, b) => {
    switch (sortOption) {
      case "upload-asc":
        return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
      case "updated-desc":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "updated-asc":
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case "score-desc":
        return getResumeScore(b) - getResumeScore(a);
      case "score-asc":
        return getResumeScore(a) - getResumeScore(b);
      case "name-asc":
        return getResumeDisplayName(a).localeCompare(
          getResumeDisplayName(b),
          "zh-CN"
        );
      case "name-desc":
        return getResumeDisplayName(b).localeCompare(
          getResumeDisplayName(a),
          "zh-CN"
        );
      case "upload-desc":
      default:
        return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    }
  });

  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    statusFilter !== "all" ||
    recommendationFilter !== "all" ||
    techFilter !== "all" ||
    tagFilter !== "all" ||
    sortOption !== "upload-desc";

  const resetControls = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setRecommendationFilter("all");
    setTechFilter("all");
    setTagFilter("all");
    setSortOption("upload-desc");
  };

  const handleTagChange = async (resumeId: string, newTag: string) => {
    // Optimistic update
    setResumes((prev) =>
      prev.map((r) => (r.id === resumeId ? { ...r, tag: newTag } : r))
    );
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: newTag }),
      });
      if (!res.ok) {
        // Revert on failure
        fetchResumes();
      }
    } catch {
      fetchResumes();
    }
  };

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
              {resumes.length > 0 && (
                <span>
                  {" "}
                  · 当前显示 {sortedResumes.length} 份
                </span>
              )}
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

      {!loading && !error && resumes.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索姓名、拼音、首字母缩写、文件名、技术方向、推荐结论"
                  className="w-full pl-9 h-11 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="flex min-w-[120px] items-center gap-2 rounded-lg border border-border/60 bg-background px-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value as TagFilter)}
                    className="h-10 w-full bg-transparent text-sm text-foreground focus:outline-none"
                    aria-label="按标签筛选"
                  >
                    <option value="all">全部标签</option>
                    <option value="校招">校招</option>
                    <option value="实习">实习</option>
                    <option value="社招">社招</option>
                    <option value="untagged">未标记</option>
                  </select>
                </label>

                <label className="flex min-w-[120px] items-center gap-2 rounded-lg border border-border/60 bg-background px-3">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-10 w-full bg-transparent text-sm text-foreground focus:outline-none"
                    aria-label="按状态筛选"
                  >
                    <option value="all">全部状态</option>
                    <option value="uploaded">已上传</option>
                    <option value="analyzing">分析中</option>
                    <option value="completed">已完成</option>
                    <option value="failed">失败</option>
                  </select>
                </label>

                <label className="flex min-w-[160px] items-center gap-2 rounded-lg border border-border/60 bg-background px-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={recommendationFilter}
                    onChange={(e) =>
                      setRecommendationFilter(
                        e.target.value as RecommendationFilter
                      )
                    }
                    className="h-10 w-full bg-transparent text-sm text-foreground focus:outline-none"
                    aria-label="按推荐结论筛选"
                  >
                    <option value="all">全部推荐结论</option>
                    <option value="strong_recommend">强烈推荐</option>
                    <option value="recommend">推荐</option>
                    <option value="cautious_recommend">谨慎推荐</option>
                    <option value="conditional">有条件推荐</option>
                    <option value="not_recommend">不推荐</option>
                  </select>
                </label>

                <label className="flex min-w-[160px] items-center gap-2 rounded-lg border border-border/60 bg-background px-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={techFilter}
                    onChange={(e) => setTechFilter(e.target.value)}
                    className="h-10 w-full bg-transparent text-sm text-foreground focus:outline-none"
                    aria-label="按技术方向筛选"
                  >
                    <option value="all">全部技术方向</option>
                    {techOptions.map((tech) => (
                      <option key={tech} value={tech}>
                        {tech}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-w-[170px] items-center gap-2 rounded-lg border border-border/60 bg-background px-3">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="h-10 w-full bg-transparent text-sm text-foreground focus:outline-none"
                    aria-label="排序方式"
                  >
                    <option value="upload-desc">上传时间: 最新优先</option>
                    <option value="upload-asc">上传时间: 最早优先</option>
                    <option value="updated-desc">分析时间: 最新优先</option>
                    <option value="updated-asc">分析时间: 最早优先</option>
                    <option value="score-desc">综合评分: 高到低</option>
                    <option value="score-asc">综合评分: 低到高</option>
                    <option value="name-asc">姓名: A-Z</option>
                    <option value="name-desc">姓名: Z-A</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {getStatusLabel(statusFilter)}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {getRecommendationLabel(recommendationFilter)}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {techFilter === "all" ? "全部技术方向" : techFilter}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {tagFilter === "all" ? "全部标签" : tagFilter === "untagged" ? "未标记" : tagFilter}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  检索结果 {sortedResumes.length} / {resumes.length}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetControls}
                disabled={!hasActiveFilters}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                清空条件
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && resumes.length > 0 && sortedResumes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center">
          <p className="text-base font-semibold text-foreground">
            没有找到符合条件的历史记录
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            可以调整搜索关键词或筛选条件，再试一次。
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={resetControls}
            className="mt-4"
          >
            重置检索条件
          </Button>
        </div>
      )}

      {/* Resume list */}
      {!loading && sortedResumes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedResumes.map((resume) => {
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
                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-indigo-500/20 max-w-[15em] truncate" title={resume.levelMatch}>
                                  {resume.levelMatch.length > 15 ? resume.levelMatch.slice(0, 15) + "…" : resume.levelMatch}
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
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <select
                        value={resume.tag ?? ""}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTagChange(resume.id, e.target.value);
                        }}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                          resume.tag
                            ? TAG_OPTIONS.find((t) => t.value === resume.tag)?.className ?? "bg-gray-100 text-gray-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <option value="">待选</option>
                        {TAG_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <StatusBadge status={resume.status} />
                    </div>
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
