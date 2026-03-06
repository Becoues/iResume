"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2, Sparkles } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
    } else {
      setError("请上传 PDF 格式的文件");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const selectedFile = e.target.files?.[0];
      if (selectedFile && selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else if (selectedFile) {
        setError("请上传 PDF 格式的文件");
      }
    },
    []
  );

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (jd.trim()) {
        formData.append("jd", jd.trim());
      }

      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "上传失败，请重试");
      }

      const data = await res.json();
      router.push(`/resumes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            AI 驱动的简历分析
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            上传简历开始评估
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            上传您的简历，AI 将从多个维度进行深度分析，帮助您优化简历内容，提升求职竞争力。
          </p>
        </div>

        {/* Upload Zone Card */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-2">
          <label className="block text-sm font-medium text-foreground mb-1">
            简历文件
          </label>
          <p className="text-sm text-muted-foreground mb-4">
            支持 PDF 格式
          </p>

          {!file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative flex flex-col items-center justify-center gap-4
                w-full min-h-[200px] rounded-lg border-2 border-dashed
                cursor-pointer transition-all duration-200 ease-in-out
                ${
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }
              `}
              aria-label="上传简历文件"
            >
              <div
                className={`
                  rounded-full p-4 transition-colors duration-200
                  ${isDragOver ? "bg-primary/10" : "bg-muted"}
                `}
              >
                <Upload
                  className={`w-8 h-8 transition-colors duration-200 ${
                    isDragOver ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  拖拽文件到此处，或{" "}
                  <span className="text-primary underline underline-offset-4">
                    点击选择文件
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  仅支持 PDF 格式
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4 transition-all duration-200">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                aria-label="移除文件"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* JD Textarea Card */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="jd-textarea"
              className="block text-sm font-medium text-foreground"
            >
              职位描述 (JD)
            </label>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              可选
            </span>
          </div>
          <textarea
            id="jd-textarea"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="粘贴职位描述，用于更精准的匹配分析..."
            rows={5}
            className="
              w-full rounded-lg border border-input bg-background px-4 py-3
              text-sm text-foreground placeholder:text-muted-foreground
              resize-y min-h-[120px]
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
            "
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={!file || isLoading}
          onClick={handleSubmit}
          className="
            w-full flex items-center justify-center gap-2
            rounded-xl px-6 py-3.5
            text-sm font-semibold text-white
            bg-gradient-to-r from-primary to-primary/80
            shadow-lg shadow-primary/20
            transition-all duration-200
            hover:shadow-xl hover:shadow-primary/30 hover:brightness-110
            active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:brightness-100
          "
          aria-label={isLoading ? "正在分析中" : "开始分析"}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在上传分析中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              开始分析
            </>
          )}
        </button>
      </div>
    </main>
  );
}
