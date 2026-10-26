"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePlus2, FileText, Search, Trash2 } from "lucide-react";
import {
  apiJson,
  ErrorNotice,
  formatDate,
  Spinner,
  statusText,
} from "@/components/prep/shared";
interface Summary {
  id: string;
  filename: string;
  uploadDate: string;
  candidateName?: string;
  techDirection?: string;
  summary?: string;
  briefStatus?: string;
}
export default function ResumesPage() {
  const [resumes, setResumes] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/resumes?limit=50&offset=0", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法加载简报。");
      setResumes(data);
      setHasMore(response.headers.get("X-Has-More") === "true");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载简报。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        `/api/resumes?limit=50&offset=${resumes.length}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法加载更多简报。");
      setResumes((items) => [
        ...items,
        ...data.filter(
          (item: Summary) => !items.some((existing) => existing.id === item.id),
        ),
      ]);
      setHasMore(response.headers.get("X-Has-More") === "true");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载更多简报。");
    } finally {
      setLoadingMore(false);
    }
  }
  async function remove(resume: Summary) {
    if (
      !window.confirm(
        `确定删除「${resume.candidateName || resume.filename}」及其简报？此操作无法撤销。`,
      )
    )
      return;
    setDeleting(resume.id);
    setError("");
    try {
      await apiJson(`/api/resumes/${resume.id}`, { method: "DELETE" });
      setResumes((items) => items.filter((item) => item.id !== resume.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试。");
    } finally {
      setDeleting(null);
    }
  }
  const filtered = resumes.filter((item) =>
    `${item.filename} ${item.candidateName || ""} ${item.techDirection || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="page history-page">
      <div className="page-heading heading-row">
        <div>
          <div className="eyebrow">YOUR BRIEFING LIBRARY</div>
          <h1>
            我的简报<span className="blue-period">.</span>
          </h1>
          <p>回到候选人的经历，继续上一次准备。</p>
        </div>
        <Link className="button primary" href="/">
          <FilePlus2 size={17} /> 新建面试准备
        </Link>
      </div>
      <div className="library-toolbar">
        <span>
          已加载 {resumes.length} 份候选人简历{hasMore ? " · 还有更多" : ""}
        </span>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="搜索候选人或文件"
            placeholder="搜索已加载的候选人或文件名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <ErrorNotice>
          {error}{" "}
          <button className="text-button" onClick={load}>
            重新加载
          </button>
        </ErrorNotice>
      )}
      {loading ? (
        <div className="empty-state panel">
          <Spinner label="正在加载你的简报…" />
        </div>
      ) : !resumes.length ? (
        <div className="empty-state panel">
          <span className="empty-icon">
            <FileText size={30} />
          </span>
          <h2>下一场面试，从这里开始</h2>
          <p>上传第一份简历，生成候选人速览和优先提问。</p>
          <Link href="/" className="button primary">
            准备第一份简报 <ArrowRight size={17} />
          </Link>
        </div>
      ) : !filtered.length ? (
        <div className="empty-state panel">
          <h2>没有匹配的简报</h2>
          <p>试试其他关键词，或清除搜索。</p>
          <button className="button secondary" onClick={() => setQuery("")}>
            清除搜索
          </button>
        </div>
      ) : (
        <div className="resume-list">
          {filtered.map((item) => (
            <article className="resume-row panel" key={item.id}>
              <Link href={`/resumes/${item.id}`} className="resume-row-link">
                <div className="resume-avatar">
                  {item.candidateName?.slice(0, 1) || <FileText size={24} />}
                </div>
                <div className="resume-row-body">
                  <div className="resume-row-title">
                    <h2>{item.candidateName || item.filename}</h2>
                    <span
                      className={`status-badge ${item.briefStatus || "idle"}`}
                    >
                      {statusText(item.briefStatus)}
                    </span>
                  </div>
                  <p>
                    {item.techDirection ||
                      item.summary ||
                      "已保存简历，打开后开始面试准备。"}
                  </p>
                  <span className="resume-meta">
                    {formatDate(item.uploadDate)} <span>·</span> {item.filename}
                  </span>
                </div>
                <ArrowRight size={18} className="row-arrow" />
              </Link>
              <button
                className="icon-button delete-button"
                aria-label={`删除 ${item.candidateName || item.filename}`}
                title="删除简历"
                disabled={
                  deleting === item.id || item.briefStatus === "running"
                }
                onClick={() => remove(item)}
              >
                {deleting === item.id ? (
                  <Spinner label="" />
                ) : (
                  <Trash2 size={17} />
                )}
              </button>
            </article>
          ))}
        </div>
      )}
      {!loading && hasMore && (
        <div className="load-more-row">
          <button
            className="button secondary"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? <Spinner label="正在加载…" /> : "加载更多简报"}
          </button>
        </div>
      )}
    </div>
  );
}
