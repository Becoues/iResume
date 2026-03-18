"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Play,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Star,
  FileText,
  Target,
  Brain,
  Database,
  Cpu,
  Users,
  Shield,
  GitBranch,
  HelpCircle,
  Eye,
  Award,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  PanelRightClose,
  PanelRightOpen,
  X,
  Mic,
  Square,
  Trash2,
  Pause,
  Clock,
  Download,
  Code,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreDetail {
  score: number;
  evidence: string;
  credibility: string;
  risk: string;
}

interface ResumeAnalysis {
  candidateProfile: {
    name: string;
    techDirection: string;
    experienceYears: string;
    levelMatch: string;
    techStack: { name: string; level: string; evidence: string }[];
  };
  architectureScoring: {
    ui: ScoreDetail;
    algorithm: ScoreDetail;
    computingPower: ScoreDetail;
    database: ScoreDetail;
    summary: string;
  };
  dnaFitness: {
    dimensions: {
      name: string;
      score: number;
      evidence: string;
      risk: string;
      verificationPoint: string;
    }[];
    summary: string;
    topStrengths: string[];
    topRisks: string[];
  };
  capabilityMatrix: {
    jdRequirement: string;
    matchLevel: string;
    verificationPriority: string;
    evidence: string;
    riskNote: string;
  }[];
  claimsAudit: {
    claim: string;
    suspiciousPoint: string;
    verificationDirection: string;
    criteria: string;
  }[];
  projectAnalysis: {
    projectName: string;
    period: string;
    background: string;
    successMetrics: string;
    architectureDescription: string;
    techQuestions: { question: string; expectedKeywords: string[] }[];
    contradictions: {
      description: string;
      reason: string;
      possibleTruth: string;
    }[];
    decisionTree: {
      choice: string;
      branches: { question: string; keyPoints: string }[];
    }[];
    results: string;
    mustAskQuestions: string[];
  }[];
  assessmentFramework: {
    weights: { dimension: string; weight: string; reason: string }[];
    topStrengths: string[];
    topRisks: string[];
    topVerificationPoints: string[];
  };
  technicalQuestions: {
    id: number;
    level: string;
    question: string;
    examPoint: string;
    expectedPoints: string;
    followUp: string;
  }[];
  algorithmQuestions: {
    id: number;
    difficulty: string;
    problem: string;
    testCases: string[];
    examPoints: string;
    solutionApproach: string;
    followUp: string;
  }[];
  keyObservations: {
    dimension: string;
    rating: string;
    detail: string;
  }[];
  scoreCard: {
    architectureTotal: number;
    dnaTotal: number;
    finalScore: number;
    recommendation: string;
    highlight: string;
    risk: string;
    mustAskQuestion: string;
  };
}

interface ResumeRecord {
  id: string;
  filename: string;
  status: string;
  uploadDate: string;
  analysisJson: ResumeAnalysis | null;
  pdfText: string;
  jdText: string | null;
  errorMessage: string | null;
}

interface FavoriteItem {
  id: string;
  sectionKey: string;
  title: string;
  subtitle?: string;
}

interface RecordingItem {
  id: string;
  filename: string;
  duration: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Section definitions for sidebar navigation
// ---------------------------------------------------------------------------

interface SectionDef {
  key: string;
  index: number;
  icon: string;
  title: string;
  lucideIcon: React.ComponentType<{ className?: string }>;
}

const SECTION_DEFS: SectionDef[] = [
  { key: "candidateProfile", index: 0, icon: "\uD83D\uDC64", title: "\u5019\u9009\u4EBA\u6863\u6848", lucideIcon: Users },
  { key: "architectureScoring", index: 1, icon: "\uD83D\uDCCA", title: "\u56DB\u5C42\u67B6\u6784\u8BC4\u5206", lucideIcon: BarChart3 },
  { key: "dnaFitness", index: 2, icon: "\uD83E\uDDEC", title: "DNA\u9002\u914D\u5EA6", lucideIcon: Brain },
  { key: "capabilityMatrix", index: 3, icon: "\uD83C\uDFAF", title: "\u80FD\u529B\u77E9\u9635", lucideIcon: Target },
  { key: "claimsAudit", index: 4, icon: "\uD83D\uDEE1\uFE0F", title: "\u6280\u672F\u5BA1\u8BA1", lucideIcon: Shield },
  { key: "projectAnalysis", index: 5, icon: "\uD83D\uDD00", title: "\u9879\u76EE\u89E3\u6790", lucideIcon: GitBranch },
  { key: "assessmentFramework", index: 6, icon: "\uD83D\uDCD0", title: "\u8003\u5BDF\u6846\u67B6", lucideIcon: FileText },
  { key: "technicalQuestions", index: 7, icon: "\u2753", title: "\u6280\u672F\u95EE\u9898", lucideIcon: HelpCircle },
  { key: "algorithmQuestions", index: 8, icon: "\uD83D\uDCBB", title: "\u7B97\u6CD5\u9898", lucideIcon: Code },
  { key: "keyObservations", index: 9, icon: "\uD83D\uDC41\uFE0F", title: "\u5173\u952E\u89C2\u5BDF", lucideIcon: Eye },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score < 2) return "bg-red-500";
  if (score < 3.5) return "bg-yellow-500";
  return "bg-emerald-500";
}

function scoreTextColor(score: number): string {
  if (score < 2) return "text-red-600";
  if (score < 3.5) return "text-yellow-600";
  return "text-emerald-600";
}

function matchBadge(level: string) {
  const map: Record<string, string> = {
    strong: "bg-emerald-100 text-emerald-700 border-emerald-200",
    partial: "bg-yellow-100 text-yellow-700 border-yellow-200",
    weak: "bg-orange-100 text-orange-700 border-orange-200",
    missing: "bg-red-100 text-red-700 border-red-200",
  };
  const labelMap: Record<string, string> = {
    strong: "\u5F3A\u5339\u914D",
    partial: "\u90E8\u5206\u5339\u914D",
    weak: "\u5F31\u5339\u914D",
    missing: "\u7F3A\u5931",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[level] || "bg-gray-100 text-gray-700 border-gray-200"}`}
    >
      {labelMap[level] || level}
    </span>
  );
}

function recommendationStyle(rec: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    strong_recommend: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      label: "\u5F3A\u70C8\u63A8\u8350",
    },
    recommend: {
      bg: "bg-green-50",
      text: "text-green-700",
      label: "\u63A8\u8350",
    },
    conditional: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      label: "\u6709\u6761\u4EF6\u63A8\u8350",
    },
    not_recommend: {
      bg: "bg-red-50",
      text: "text-red-700",
      label: "\u4E0D\u63A8\u8350",
    },
  };
  return map[rec] || { bg: "bg-gray-100", text: "text-gray-700", label: rec };
}

function finalScoreGradient(score: number): string {
  if (score >= 85) return "from-emerald-500 to-teal-500";
  if (score >= 70) return "from-green-500 to-emerald-500";
  if (score >= 50) return "from-yellow-500 to-amber-500";
  return "from-red-500 to-rose-500";
}

// ---------------------------------------------------------------------------
// Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  score,
  maxScore = 5,
  icon,
}: {
  label: string;
  score: number;
  maxScore?: number;
  icon?: string;
}) {
  const pct = Math.min((score / maxScore) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {icon && <span className="mr-1.5">{icon}</span>}
          {label}
        </span>
        <span className={`font-bold ${scoreTextColor(score)}`}>
          {score.toFixed(1)} / {maxScore}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreColor(score)} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Favorite Toggle Button
// ---------------------------------------------------------------------------

function FavoriteButton({
  isFavorited,
  onToggle,
}: {
  isFavorited: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`absolute top-2 right-2 p-1 rounded-md transition-colors z-10 ${
        isFavorited
          ? "text-amber-500 hover:text-amber-600 bg-amber-50"
          : "text-gray-300 hover:text-gray-500 hover:bg-gray-50"
      }`}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorited ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ResumePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Streaming state
  const [streamText, setStreamText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0); // 0=not started, 1/2/3=which steps done (bitmask-like tracking)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set()); // tracks which of the 3 steps are done
  const streamRef = useRef<HTMLPreElement>(null);

  // Active section for sidebar navigation
  const [activeSection, setActiveSection] = useState<string>("candidateProfile");

  // Favorites (persisted in localStorage per resume)
  const favStorageKey = `favorites-${id}`;
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(favStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showFavorites, setShowFavorites] = useState(true);

  // Sync favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(favStorageKey, JSON.stringify(favorites));
    } catch {
      // storage full or unavailable
    }
  }, [favorites, favStorageKey]);

  // Recordings
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const recordingTimeRef = useRef(0);

  const toggleFavorite = useCallback(
    (item: FavoriteItem) => {
      setFavorites((prev) => {
        const exists = prev.find((f) => f.id === item.id);
        if (exists) {
          return prev.filter((f) => f.id !== item.id);
        }
        return [...prev, item];
      });
    },
    []
  );

  const isFavorited = useCallback(
    (itemId: string) => favorites.some((f) => f.id === itemId),
    [favorites]
  );

  const removeFavorite = useCallback((itemId: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== itemId));
  }, []);

  const navigateToFavorite = useCallback(
    (fav: FavoriteItem) => {
      setActiveSection(fav.sectionKey);
      setTimeout(() => {
        const el = document.getElementById(fav.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-amber-400", "ring-offset-2");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
          }, 2000);
        }
      }, 150);
    },
    []
  );

  // -----------------------------------------------------------------------
  // Recording functions
  // -----------------------------------------------------------------------
  const fetchRecordings = useCallback(async () => {
    try {
      const res = await fetch(`/api/resumes/${id}/recordings`);
      if (res.ok) {
        const data = await res.json();
        setRecordings(data);
      }
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const duration = recordingTimeRef.current;

        // Upload
        setIsUploadingRecording(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          formData.append("duration", String(duration));
          const res = await fetch(`/api/resumes/${id}/recordings`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            await fetchRecordings();
          }
        } catch {
          // silent
        } finally {
          setIsUploadingRecording(false);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          recordingTimeRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("无法访问麦克风，请检查浏览器权限设置");
    }
  }, [id, fetchRecordings]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const deleteRecording = useCallback(
    async (recordingId: string) => {
      try {
        const res = await fetch(
          `/api/resumes/${id}/recordings/${recordingId}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
          if (playingId === recordingId) setPlayingId(null);
        }
      } catch {
        // silent
      }
    },
    [id, playingId]
  );

  const togglePlayback = useCallback(
    (recordingId: string) => {
      // Stop current playback
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause();
        audioRefs.current[playingId].currentTime = 0;
      }

      if (playingId === recordingId) {
        setPlayingId(null);
        return;
      }

      // Play new
      if (!audioRefs.current[recordingId]) {
        audioRefs.current[recordingId] = new Audio(
          `/api/resumes/${id}/recordings/${recordingId}`
        );
        audioRefs.current[recordingId].onended = () => setPlayingId(null);
      }
      audioRefs.current[recordingId].play();
      setPlayingId(recordingId);
    },
    [id, playingId]
  );

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // -----------------------------------------------------------------------
  // Fetch resume
  // -----------------------------------------------------------------------
  const fetchResume = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/resumes/${id}`);
      if (!res.ok) throw new Error("Failed to load resume");
      const data = await res.json();
      setResume(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

  // Auto-scroll streaming text
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  // Poll for completion when status is "analyzing" but we're not the ones streaming
  useEffect(() => {
    if (resume?.status === "analyzing" && !analyzing) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/resumes/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status !== "analyzing") {
              setResume(data);
              clearInterval(interval);
            }
          }
        } catch {
          // silent
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [resume?.status, analyzing, id]);

  // -----------------------------------------------------------------------
  // Start analysis (streaming)
  // -----------------------------------------------------------------------
  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setStreamText("");
    setAnalysisPhase(1);
    setDoneSteps(new Set());
    try {
      const res = await fetch(`/api/analyze/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Analysis request failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          // Parse SSE completion markers
          if (text.includes("[DONE:1]")) {
            setDoneSteps((prev) => new Set(prev).add(1));
          }
          if (text.includes("[DONE:2]")) {
            setDoneSteps((prev) => new Set(prev).add(2));
          }
          if (text.includes("[DONE:3]")) {
            setDoneSteps((prev) => new Set(prev).add(3));
          }
          setStreamText((prev) => prev + text);
        }
      }
      // Refetch to get structured analysis
      await fetchResume();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      setAnalysisPhase(0);
      setDoneSteps(new Set());
    }
  }, [id, fetchResume]);

  // -----------------------------------------------------------------------
  // Loading / Error states
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-muted-foreground text-sm">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchResume();
          }}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!resume) return null;

  const analysis = resume.analysisJson;
  const isUploaded = resume.status === "uploaded";
  const isAnalyzing = resume.status === "analyzing" || analyzing;
  const isCompleted = resume.status === "completed" && analysis;

  // -----------------------------------------------------------------------
  // Render: Uploaded state
  // -----------------------------------------------------------------------
  if (isUploaded && !analyzing) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <BackButton />
        <ResumeHeader resume={resume} />
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 py-20 gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/25">
            <Play className="h-9 w-9 text-white ml-1" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">准备就绪</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              简历已成功上传，点击下方按钮开始 AI 深度分析
            </p>
          </div>
          <button
            onClick={startAnalysis}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-700 hover:to-blue-700 transition-all active:scale-[0.98]"
          >
            <Play className="h-5 w-5" />
            开始分析
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Analyzing state (streaming)
  // -----------------------------------------------------------------------
  if (isAnalyzing) {
    const isActivelyAnalyzing = analyzing && analysisPhase > 0;
    const completedCount = doneSteps.size;
    const steps = [
      { id: 1, label: "简历深度分析", desc: "评估四层架构、DNA维度、项目分析、声明审计等" },
      { id: 2, label: "生成技术面试题", desc: "生成15道技术面试题（基础/中级/专家）" },
      { id: 3, label: "生成算法题", desc: "生成9道算法题（简单/中等/困难）" },
    ];
    const progressPct = isActivelyAnalyzing
      ? Math.min(10 + (completedCount / 3) * 85, 95)
      : 50;

    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <BackButton />
        <ResumeHeader resume={resume} />
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-blue-50/80 p-8 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg shadow-violet-500/20">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {!isActivelyAnalyzing ? "分析进行中..." : "AI 正在并行分析简历"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {!isActivelyAnalyzing
                  ? "请稍候，分析完成后将自动刷新"
                  : `三项任务并行处理中，已完成 ${completedCount}/3`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-violet-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-1000 ease-out"
              style={{
                width: `${progressPct}%`,
                animation: completedCount < 3 ? "pulse 2s ease-in-out infinite" : "none",
              }}
            />
          </div>

          {/* Steps */}
          {isActivelyAnalyzing && (
            <div className="space-y-3">
              {steps.map((step) => {
                const isDone = doneSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-4 rounded-xl p-4 transition-all ${
                      isDone
                        ? "bg-white/50"
                        : "bg-white shadow-sm border border-violet-100"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${isDone ? "text-emerald-700" : "text-violet-700"}`}>
                        {step.label}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Failed state
  // -----------------------------------------------------------------------
  if (resume.status === "failed" && !analyzing) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <BackButton />
        <ResumeHeader resume={resume} />
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-200 bg-gradient-to-br from-red-50 to-orange-50 py-16 gap-6 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-center space-y-2 max-w-lg">
            <h2 className="text-xl font-bold text-foreground">分析失败</h2>
            {resume.errorMessage && (
              <div className="rounded-lg bg-red-100/80 border border-red-200 px-4 py-3 text-sm text-red-700 text-left break-all whitespace-pre-wrap">
                {resume.errorMessage}
              </div>
            )}
          </div>
          <button
            onClick={startAnalysis}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-700 hover:to-blue-700 transition-all active:scale-[0.98]"
          >
            <Play className="h-5 w-5" />
            重新分析
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Completed state
  // -----------------------------------------------------------------------
  if (!isCompleted || !analysis) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <BackButton />
        <ResumeHeader resume={resume} />
        <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
          <HelpCircle className="h-10 w-10" />
          <p>暂无分析数据</p>
        </div>
      </div>
    );
  }

  const sc = analysis.scoreCard;
  const recStyle = recommendationStyle(sc?.recommendation || "");

  // Determine which sections are available
  const availableSections = SECTION_DEFS.filter((s) => {
    const val = analysis[s.key as keyof ResumeAnalysis];
    return val !== undefined && val !== null;
  });

  // Ensure activeSection is valid
  const currentSection =
    availableSections.find((s) => s.key === activeSection) ||
    availableSections[0];

  // Find section def by key for favorites panel
  const findSectionDef = (key: string) => SECTION_DEFS.find((s) => s.key === key);

  return (
    <div className="pb-16">
      {/* Header area with padding */}
      <div className={`px-6 pt-6 pb-4 lg:ml-[220px] ${showFavorites ? "lg:mr-[240px]" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <BackButton />
          {/* Recording button */}
          <div className="flex items-center gap-3">
            {isRecording ? (
              <div className="flex items-center gap-2.5 rounded-full bg-red-50 border border-red-200 pl-3 pr-1.5 py-1.5 animate-pulse">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-sm font-mono font-semibold text-red-600">
                  {formatDuration(recordingTime)}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  aria-label="停止录音"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              </div>
            ) : isUploadingRecording ? (
              <div className="flex items-center gap-2 rounded-full bg-violet-50 border border-violet-200 px-3 py-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                <span className="text-xs font-medium text-violet-600">保存中...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-violet-300 hover:bg-violet-50 shadow-sm transition-all"
                aria-label="开始录音"
              >
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">录音</span>
              </button>
            )}
          </div>
        </div>
        <ResumeHeader resume={resume} />
      </div>

      {/* ============================================================= */}
      {/* LEFT SIDEBAR - Fixed on desktop, horizontal tabs on mobile */}
      {/* ============================================================= */}

      {/* Mobile: horizontal scrollable tab bar */}
      <div className="lg:hidden overflow-x-auto px-6 pb-3">
        <div className="flex gap-1.5 min-w-max">
          {availableSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                currentSection?.key === section.key
                  ? "bg-violet-100 text-violet-700 shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: fixed vertical sidebar */}
      <nav className="hidden lg:block fixed left-0 top-16 bottom-0 w-[220px] border-r border-border/60 bg-card overflow-y-auto z-40">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            分析章节
          </h3>
        </div>
        <div className="py-1">
          {availableSections.map((section) => {
            const isActive = currentSection?.key === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-all ${
                  isActive
                    ? "bg-violet-50 text-violet-700 border-l-[3px] border-violet-500 font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-[3px] border-transparent"
                }`}
              >
                <span className="text-base leading-none">{section.icon}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs opacity-50">{section.index}.</span>
                  <span>{section.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ============================================================= */}
      {/* RIGHT FAVORITES PANEL - Fixed on desktop */}
      {/* ============================================================= */}
      {showFavorites && (
        <div className="hidden lg:flex fixed right-0 top-16 bottom-0 w-[240px] border-l border-border/60 bg-card z-40 flex-col">
          <div className="flex items-center justify-between px-3 py-3 border-b border-border/40">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              收藏夹 ({favorites.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowFavorites(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close favorites panel"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
                <Bookmark className="h-6 w-6 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">暂无收藏</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  点击书签图标收藏
                </p>
              </div>
            ) : (
              favorites.map((fav) => {
                const sectionDef = findSectionDef(fav.sectionKey);
                return (
                  <div
                    key={fav.id}
                    className="flex items-start gap-2 px-3 py-2 mx-1 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                    onClick={() => navigateToFavorite(fav)}
                  >
                    <span className="text-sm leading-none mt-0.5 shrink-0">
                      {sectionDef?.icon || ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {fav.title}
                      </p>
                      {fav.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {fav.subtitle}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(fav.id);
                      }}
                      className="p-0.5 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                      aria-label="Remove favorite"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}

            {/* Recordings section */}
            <div className="border-t border-border/40 mt-3 pt-3">
              <div className="px-3 pb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5" />
                  录音 ({recordings.length})
                </h3>
              </div>
              {recordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
                  <Mic className="h-5 w-5 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">暂无录音</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    点击右上角开始
                  </p>
                </div>
              ) : (
                recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-1.5 px-2 py-2 mx-1 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => togglePlayback(rec.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-colors ${
                        playingId === rec.id
                          ? "bg-violet-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-600"
                      }`}
                      aria-label={playingId === rec.id ? "暂停" : "播放"}
                    >
                      {playingId === rec.id ? (
                        <Pause className="h-3 w-3 fill-current" />
                      ) : (
                        <Play className="h-3 w-3 ml-0.5 fill-current" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {rec.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDuration(rec.duration)}
                        </span>
                        <span className="text-xs text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rec.createdAt).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`/api/resumes/${id}/recordings/${rec.id}`}
                      download={`${rec.filename}.webm`}
                      className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-violet-500 transition-colors shrink-0"
                      aria-label="下载录音"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteRecording(rec.id)}
                      className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                      aria-label="删除录音"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle favorites button when panel is hidden */}
      {!showFavorites && (
        <button
          type="button"
          onClick={() => setShowFavorites(true)}
          className="hidden lg:flex fixed right-4 top-20 z-40 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground shadow-sm hover:shadow transition-all"
        >
          <PanelRightOpen className="h-4 w-4" />
          收藏夹
          {favorites.length > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-semibold text-amber-700">
              {favorites.length}
            </span>
          )}
        </button>
      )}

      {/* ============================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================================= */}
      <div className={`lg:ml-[220px] ${showFavorites ? "lg:mr-[240px]" : ""} px-6`}>
        <div className="space-y-6">
          {/* Currently selected section content */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {/* Section header */}
            {currentSection && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 bg-gradient-to-r from-violet-50/50 to-transparent">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-blue-500/10 text-sm font-bold text-violet-600">
                  {currentSection.index}
                </span>
                <currentSection.lucideIcon className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 font-semibold text-foreground">
                  {currentSection.title}
                </span>
              </div>
            )}

            {/* Section content */}
            <div className="px-5 py-5">
              {/* SECTION: Candidate Profile (with Score Card at top) */}
              {currentSection?.key === "candidateProfile" && analysis.candidateProfile && (
                <div className="space-y-5">
                  {/* Score Card moved here */}
                  {sc && (
                    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-6 shadow-sm space-y-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                        <div
                          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${finalScoreGradient(sc.finalScore)} shadow-lg`}
                        >
                          <span className="text-3xl font-black text-white">
                            {sc.finalScore}
                          </span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-lg font-bold text-foreground">综合评分</h2>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${recStyle.bg} ${recStyle.text}`}
                            >
                              <Award className="mr-1.5 h-4 w-4" />
                              {recStyle.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>
                              架构总分:{" "}
                              <strong className="text-foreground">
                                {sc.architectureTotal}/20
                              </strong>
                            </span>
                            <span>
                              DNA 总分:{" "}
                              <strong className="text-foreground">{sc.dnaTotal}/30</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                          <p className="text-xs font-medium text-emerald-600 mb-1">
                            <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                            亮点
                          </p>
                          <p className="text-sm text-emerald-800">{sc.highlight}</p>
                        </div>
                        <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                          <p className="text-xs font-medium text-orange-600 mb-1">
                            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                            风险
                          </p>
                          <p className="text-sm text-orange-800">{sc.risk}</p>
                        </div>
                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            <HelpCircle className="inline h-3.5 w-3.5 mr-1" />
                            必问问题
                          </p>
                          <p className="text-sm text-blue-800">{sc.mustAskQuestion}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      ["\u59D3\u540D", analysis.candidateProfile.name],
                      ["\u6280\u672F\u65B9\u5411", analysis.candidateProfile.techDirection],
                      ["\u5DE5\u4F5C\u5E74\u9650", analysis.candidateProfile.experienceYears],
                      ["\u5C42\u7EA7\u5339\u914D", analysis.candidateProfile.levelMatch],
                    ].map(([label, val]) => (
                      <div key={label} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {val}
                        </p>
                      </div>
                    ))}
                  </div>
                  {analysis.candidateProfile.techStack?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-foreground">
                        技术栈
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {analysis.candidateProfile.techStack.map((tech, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                                {tech.name}
                              </p>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {tech.evidence}
                              </p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <Star
                                  key={si}
                                  className={`h-3.5 w-3.5 ${
                                    si <
                                    (tech.level === "expert"
                                      ? 5
                                      : tech.level === "advanced"
                                        ? 4
                                        : tech.level === "intermediate"
                                          ? 3
                                          : tech.level === "beginner"
                                            ? 2
                                            : parseInt(tech.level) || 3)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: Architecture Scoring */}
              {currentSection?.key === "architectureScoring" && analysis.architectureScoring && (
                <div className="space-y-5">
                  {(
                    [
                      ["ui", "UI (\u534F\u4F5C\u4E0E\u8868\u8FBE)", "\uD83D\uDDA5\uFE0F"],
                      ["algorithm", "Algorithm (\u4E13\u4E1A\u57FA\u7EBF)", "\u2699\uFE0F"],
                      ["computingPower", "Computing Power (\u7B97\u529B\u4E0E\u6F5C\u529B)", "\u26A1"],
                      ["database", "Database (\u7ECF\u9A8C\u50A8\u5907)", "\uD83D\uDCBE"],
                    ] as const
                  ).map(([key, label, icon]) => {
                    const detail = analysis.architectureScoring[key];
                    if (!detail) return null;
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-border/40 p-4 space-y-3"
                      >
                        <ScoreBar label={label} score={detail.score} icon={icon} />
                        <div className="grid gap-2 sm:grid-cols-3 text-xs">
                          <div className="rounded bg-emerald-50 p-2">
                            <span className="font-medium text-emerald-700">
                              证据:
                            </span>{" "}
                            <span className="text-emerald-800 whitespace-pre-wrap break-words">
                              {detail.evidence}
                            </span>
                          </div>
                          <div className="rounded bg-blue-50 p-2">
                            <span className="font-medium text-blue-700">
                              可信度:
                            </span>{" "}
                            <span className="text-blue-800 whitespace-pre-wrap break-words">
                              {detail.credibility}
                            </span>
                          </div>
                          <div className="rounded bg-orange-50 p-2">
                            <span className="font-medium text-orange-700">
                              风险:
                            </span>{" "}
                            <span className="text-orange-800 whitespace-pre-wrap break-words">
                              {detail.risk}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {analysis.architectureScoring.summary && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      <strong className="text-foreground">总结:</strong>{" "}
                      {analysis.architectureScoring.summary}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: DNA Fitness */}
              {currentSection?.key === "dnaFitness" && analysis.dnaFitness && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {analysis.dnaFitness.dimensions.map((dim, i) => {
                      const favId = `dnaFitness-${i}`;
                      return (
                        <div
                          key={i}
                          id={favId}
                          className="relative rounded-lg border border-border/40 p-4 space-y-3 transition-all"
                        >
                          <FavoriteButton
                            isFavorited={isFavorited(favId)}
                            onToggle={() =>
                              toggleFavorite({
                                id: favId,
                                sectionKey: "dnaFitness",
                                title: dim.name,
                                subtitle: `评分: ${dim.score}/5`,
                              })
                            }
                          />
                          <ScoreBar label={dim.name} score={dim.score} />
                          <div className="space-y-1.5 text-xs">
                            <p className="whitespace-pre-wrap break-words">
                              <span className="font-medium text-emerald-700">
                                证据:
                              </span>{" "}
                              {dim.evidence}
                            </p>
                            <p className="whitespace-pre-wrap break-words">
                              <span className="font-medium text-orange-700">
                                风险:
                              </span>{" "}
                              {dim.risk}
                            </p>
                            <p className="whitespace-pre-wrap break-words">
                              <span className="font-medium text-blue-700">
                                验证点:
                              </span>{" "}
                              {dim.verificationPoint}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {analysis.dnaFitness.summary && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      <strong className="text-foreground">总结:</strong>{" "}
                      {analysis.dnaFitness.summary}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {analysis.dnaFitness.topStrengths?.length > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                        <h5 className="text-xs font-semibold text-emerald-700 mb-2">
                          核心优势
                        </h5>
                        <ul className="space-y-1">
                          {analysis.dnaFitness.topStrengths.map((s, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1.5 text-xs text-emerald-800"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span className="whitespace-pre-wrap break-words">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.dnaFitness.topRisks?.length > 0 && (
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                        <h5 className="text-xs font-semibold text-orange-700 mb-2">
                          主要风险
                        </h5>
                        <ul className="space-y-1">
                          {analysis.dnaFitness.topRisks.map((r, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1.5 text-xs text-orange-800"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span className="whitespace-pre-wrap break-words">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 4: Capability Matrix */}
              {currentSection?.key === "capabilityMatrix" && analysis.capabilityMatrix && (
                <div className="overflow-x-auto">
                  <table className="table-fixed w-full text-sm border-collapse">
                    <colgroup>
                      <col className="w-[20%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                      <col className="w-[35%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border/60">
                        {["JD\u8981\u6C42", "\u5339\u914D\u5EA6", "\u9A8C\u8BC1\u4F18\u5148\u7EA7", "\u8BC1\u636E", "\u98CE\u9669"].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.capabilityMatrix.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-3 py-2.5 font-medium text-foreground whitespace-pre-wrap break-words">
                            {row.jdRequirement}
                          </td>
                          <td className="px-3 py-2.5">
                            {matchBadge(row.matchLevel)}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-pre-wrap break-words">
                            {row.verificationPriority}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-pre-wrap break-words">
                            {row.evidence}
                          </td>
                          <td className="px-3 py-2.5 text-orange-600 text-xs whitespace-pre-wrap break-words">
                            {row.riskNote}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SECTION 5: Claims Audit */}
              {currentSection?.key === "claimsAudit" && analysis.claimsAudit && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {analysis.claimsAudit.map((claim, i) => {
                    const favId = `claimsAudit-${i}`;
                    return (
                      <div
                        key={i}
                        id={favId}
                        className="relative rounded-lg border border-border/50 p-4 space-y-2.5 hover:shadow-sm transition-all"
                      >
                        <FavoriteButton
                          isFavorited={isFavorited(favId)}
                          onToggle={() =>
                            toggleFavorite({
                              id: favId,
                              sectionKey: "claimsAudit",
                              title: claim.claim,
                              subtitle: claim.suspiciousPoint,
                            })
                          }
                        />
                        <p className="text-sm font-semibold text-foreground whitespace-pre-wrap break-words pr-8">
                          {claim.claim}
                        </p>
                        <div className="space-y-1.5 text-xs">
                          <p className="whitespace-pre-wrap break-words">
                            <span className="font-medium text-orange-600">
                              可疑点:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {claim.suspiciousPoint}
                            </span>
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            <span className="font-medium text-blue-600">
                              验证方向:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {claim.verificationDirection}
                            </span>
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            <span className="font-medium text-emerald-600">
                              评判标准:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {claim.criteria}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SECTION 6: Project Analysis */}
              {currentSection?.key === "projectAnalysis" && analysis.projectAnalysis && (
                <div className="space-y-4">
                  {analysis.projectAnalysis.map((project, pi) => {
                    const favId = `projectAnalysis-${pi}`;
                    return (
                      <div key={pi} id={favId} className="relative transition-all">
                        <FavoriteButton
                          isFavorited={isFavorited(favId)}
                          onToggle={() =>
                            toggleFavorite({
                              id: favId,
                              sectionKey: "projectAnalysis",
                              title: project.projectName,
                              subtitle: project.period,
                            })
                          }
                        />
                        <ProjectAccordion project={project} index={pi} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SECTION 7: Assessment Framework */}
              {currentSection?.key === "assessmentFramework" && analysis.assessmentFramework && (
                <div className="space-y-5">
                  {/* Weights table */}
                  {analysis.assessmentFramework.weights?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="table-fixed w-full text-sm border-collapse">
                        <colgroup>
                          <col className="w-[25%]" />
                          <col className="w-[15%]" />
                          <col className="w-[60%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border/60">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                              维度
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                              权重
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">
                              原因
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.assessmentFramework.weights.map((w, i) => (
                            <tr
                              key={i}
                              className="border-b border-border/30 hover:bg-muted/30"
                            >
                              <td className="px-3 py-2 font-medium whitespace-pre-wrap break-words">
                                {w.dimension}
                              </td>
                              <td className="px-3 py-2 text-violet-600 font-semibold whitespace-pre-wrap break-words">
                                {w.weight}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground whitespace-pre-wrap break-words">
                                {w.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {analysis.assessmentFramework.topStrengths?.length > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                        <h5 className="text-xs font-semibold text-emerald-700 mb-2">
                          核心优势
                        </h5>
                        <ul className="space-y-1">
                          {analysis.assessmentFramework.topStrengths.map(
                            (s, i) => (
                              <li
                                key={i}
                                className="text-xs text-emerald-800 flex items-start gap-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span className="whitespace-pre-wrap break-words">{s}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {analysis.assessmentFramework.topRisks?.length > 0 && (
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                        <h5 className="text-xs font-semibold text-orange-700 mb-2">
                          主要风险
                        </h5>
                        <ul className="space-y-1">
                          {analysis.assessmentFramework.topRisks.map((r, i) => (
                            <li
                              key={i}
                              className="text-xs text-orange-800 flex items-start gap-1.5"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span className="whitespace-pre-wrap break-words">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.assessmentFramework.topVerificationPoints?.length >
                      0 && (
                      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                        <h5 className="text-xs font-semibold text-blue-700 mb-2">
                          重点验证
                        </h5>
                        <ul className="space-y-1">
                          {analysis.assessmentFramework.topVerificationPoints.map(
                            (v, i) => (
                              <li
                                key={i}
                                className="text-xs text-blue-800 flex items-start gap-1.5"
                              >
                                <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span className="whitespace-pre-wrap break-words">{v}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 8: Technical Questions */}
              {currentSection?.key === "technicalQuestions" && analysis.technicalQuestions && (
                <TechnicalQuestionsView
                  questions={analysis.technicalQuestions}
                  isFavorited={isFavorited}
                  toggleFavorite={toggleFavorite}
                />
              )}

              {/* SECTION: Algorithm Questions */}
              {currentSection?.key === "algorithmQuestions" && analysis.algorithmQuestions && (
                <AlgorithmQuestionsView
                  questions={analysis.algorithmQuestions}
                  isFavorited={isFavorited}
                  toggleFavorite={toggleFavorite}
                />
              )}

              {/* SECTION 9: Key Observations */}
              {currentSection?.key === "keyObservations" && analysis.keyObservations && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {analysis.keyObservations.map((obs, i) => {
                    const ratingColorMap: Record<string, string> = {
                      positive: "border-emerald-200 bg-emerald-50",
                      neutral: "border-blue-200 bg-blue-50",
                      negative: "border-red-200 bg-red-50",
                      concern: "border-orange-200 bg-orange-50",
                    };
                    const ratingTextMap: Record<string, string> = {
                      positive: "text-emerald-700",
                      neutral: "text-blue-700",
                      negative: "text-red-700",
                      concern: "text-orange-700",
                    };
                    const colorClass =
                      ratingColorMap[obs.rating] ||
                      "border-gray-200 bg-gray-50";
                    const textClass =
                      ratingTextMap[obs.rating] || "text-gray-700";
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 space-y-2 ${colorClass}`}
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-foreground">
                            {obs.dimension}
                          </h5>
                          <span
                            className={`text-xs font-semibold uppercase ${textClass}`}
                          >
                            {obs.rating}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {obs.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (inline, no separate files)
// ---------------------------------------------------------------------------

function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/resumes")}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      返回列表
    </button>
  );
}

function ResumeHeader({ resume }: { resume: ResumeRecord }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    uploaded: {
      label: "\u5DF2\u4E0A\u4F20",
      color: "bg-blue-100 text-blue-700",
    },
    analyzing: {
      label: "\u5206\u6790\u4E2D",
      color: "bg-yellow-100 text-yellow-700",
    },
    completed: {
      label: "\u5DF2\u5B8C\u6210",
      color: "bg-emerald-100 text-emerald-700",
    },
    error: {
      label: "\u9519\u8BEF",
      color: "bg-red-100 text-red-700",
    },
  };
  const st = statusMap[resume.status] || {
    label: resume.status,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 shrink-0">
          <FileText className="h-5 w-5 text-violet-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">
            {resume.filename}
          </h1>
          <p className="text-xs text-muted-foreground">
            上传于{" "}
            {new Date(resume.uploadDate).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
      <span
        className={`inline-flex items-center self-start rounded-full px-2.5 py-1 text-xs font-semibold ${st.color}`}
      >
        {st.label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Accordion (Section 6)
// ---------------------------------------------------------------------------

function ProjectAccordion({
  project,
  index,
}: {
  project: ResumeAnalysis["projectAnalysis"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-violet-100 text-xs font-bold text-violet-600">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap break-words">
            {project.projectName}
          </p>
          {project.period && (
            <p className="text-xs text-muted-foreground">{project.period}</p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${open ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div className="border-t border-border/40 px-4 py-4 space-y-4 text-sm">
          {/* Background */}
          {project.background && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                项目背景
              </h6>
              <p className="text-foreground whitespace-pre-wrap break-words">{project.background}</p>
            </div>
          )}

          {/* Success Metrics */}
          {project.successMetrics && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                成功指标
              </h6>
              <p className="text-foreground whitespace-pre-wrap break-words">{project.successMetrics}</p>
            </div>
          )}

          {/* Architecture */}
          {project.architectureDescription && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                架构描述
              </h6>
              <p className="text-foreground whitespace-pre-wrap break-words">
                {project.architectureDescription}
              </p>
            </div>
          )}

          {/* Tech Questions */}
          {project.techQuestions?.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                技术问题
              </h6>
              <div className="space-y-2">
                {project.techQuestions.map((tq, i) => (
                  <div
                    key={i}
                    className="rounded bg-blue-50 border border-blue-100 p-2.5"
                  >
                    <p className="text-sm font-medium text-blue-800 whitespace-pre-wrap break-words">
                      {tq.question}
                    </p>
                    {tq.expectedKeywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tq.expectedKeywords.map((kw, ki) => (
                          <span
                            key={ki}
                            className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contradictions */}
          {project.contradictions?.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                矛盾点
              </h6>
              <div className="space-y-2">
                {project.contradictions.map((c, i) => (
                  <div
                    key={i}
                    className="rounded bg-orange-50 border border-orange-100 p-2.5 space-y-1"
                  >
                    <p className="text-sm font-medium text-orange-800 whitespace-pre-wrap break-words">
                      {c.description}
                    </p>
                    <p className="text-xs text-orange-700 whitespace-pre-wrap break-words">
                      <strong>原因:</strong> {c.reason}
                    </p>
                    <p className="text-xs text-orange-700 whitespace-pre-wrap break-words">
                      <strong>可能真相:</strong> {c.possibleTruth}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Tree */}
          {project.decisionTree?.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                决策树
              </h6>
              <div className="space-y-2">
                {project.decisionTree.map((dt, i) => (
                  <div
                    key={i}
                    className="rounded border border-border/50 p-2.5"
                  >
                    <p className="text-sm font-medium text-foreground mb-1.5 whitespace-pre-wrap break-words">
                      {dt.choice}
                    </p>
                    <div className="space-y-1 pl-3 border-l-2 border-violet-200">
                      {dt.branches.map((b, bi) => (
                        <div key={bi} className="text-xs">
                          <p className="font-medium text-violet-700 whitespace-pre-wrap break-words">
                            {b.question}
                          </p>
                          <p className="text-muted-foreground whitespace-pre-wrap break-words">{b.keyPoints}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {project.results && (
            <div>
              <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                成果
              </h6>
              <p className="text-foreground whitespace-pre-wrap break-words">{project.results}</p>
            </div>
          )}

          {/* Must Ask Questions */}
          {project.mustAskQuestions?.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                必问问题
              </h6>
              <ul className="space-y-1">
                {project.mustAskQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-sm text-red-700"
                  >
                    <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap break-words">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Technical Questions View (Section 8) - with favorites support
// ---------------------------------------------------------------------------

function TechnicalQuestionsView({
  questions,
  isFavorited,
  toggleFavorite,
}: {
  questions: ResumeAnalysis["technicalQuestions"];
  isFavorited: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
}) {
  const levels = ["\u57FA\u7840", "\u8FDB\u9636", "\u4E13\u5BB6"];
  const [activeLevel, setActiveLevel] = useState(levels[0]);

  const grouped = levels.reduce(
    (acc, level) => {
      acc[level] = questions.filter((q) => q.level === level);
      return acc;
    },
    {} as Record<string, typeof questions>
  );

  // If grouping yields no results for Chinese labels, try English
  const hasGrouped = levels.some((l) => grouped[l].length > 0);
  if (!hasGrouped) {
    const englishMap: Record<string, string> = {
      basic: "\u57FA\u7840",
      intermediate: "\u8FDB\u9636",
      advanced: "\u4E13\u5BB6",
      expert: "\u4E13\u5BB6",
    };
    for (const q of questions) {
      const mapped = englishMap[q.level.toLowerCase()] || "\u57FA\u7840";
      if (!grouped[mapped]) grouped[mapped] = [];
      grouped[mapped].push(q);
    }
  }

  const levelColorMap: Record<string, string> = {
    "\u57FA\u7840": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "\u8FDB\u9636": "bg-blue-100 text-blue-700 border-blue-200",
    "\u4E13\u5BB6": "bg-violet-100 text-violet-700 border-violet-200",
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(level)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeLevel === level
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {level}
            {grouped[level]?.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">
                ({grouped[level].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Questions for active level */}
      <div className="space-y-3">
        {(grouped[activeLevel] || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            该级别暂无问题
          </p>
        ) : (
          (grouped[activeLevel] || []).map((q, i) => {
            const favId = `technicalQuestions-${q.id || i}`;
            return (
              <div
                key={q.id || i}
                id={favId}
                className="relative rounded-lg border border-border/50 p-4 space-y-3 hover:shadow-sm transition-all"
              >
                <FavoriteButton
                  isFavorited={isFavorited(favId)}
                  onToggle={() =>
                    toggleFavorite({
                      id: favId,
                      sectionKey: "technicalQuestions",
                      title: q.question,
                      subtitle: `${activeLevel} - ${q.examPoint}`,
                    })
                  }
                />
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap pr-8">
                      <p className="text-sm font-semibold text-foreground flex-1 whitespace-pre-wrap break-words">
                        {q.question}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${levelColorMap[activeLevel] || ""}`}
                      >
                        {activeLevel}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      <div className="rounded bg-blue-50 p-2">
                        <span className="font-medium text-blue-700">
                          考察点:
                        </span>{" "}
                        <span className="text-blue-800 whitespace-pre-wrap break-words">{q.examPoint}</span>
                      </div>
                      <div className="rounded bg-emerald-50 p-2">
                        <span className="font-medium text-emerald-700">
                          期望要点:
                        </span>{" "}
                        <span className="text-emerald-800 whitespace-pre-wrap break-words">
                          {q.expectedPoints}
                        </span>
                      </div>
                    </div>
                    {q.followUp && (
                      <div className="rounded bg-violet-50 p-2 text-xs">
                        <span className="font-medium text-violet-700">
                          追问:
                        </span>{" "}
                        <span className="text-violet-800 whitespace-pre-wrap break-words">{q.followUp}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Algorithm Questions View (Section 8) - tab-based like Technical Questions
// ---------------------------------------------------------------------------

function AlgorithmQuestionsView({
  questions,
  isFavorited,
  toggleFavorite,
}: {
  questions: ResumeAnalysis["algorithmQuestions"];
  isFavorited: (id: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
}) {
  const difficulties = ["简单", "中等", "困难"] as const;
  const [activeDifficulty, setActiveDifficulty] = useState<string>(difficulties[0]);

  const diffMap: Record<string, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
  };

  const grouped = difficulties.reduce(
    (acc, diff) => {
      acc[diff] = questions.filter((q) => diffMap[q.difficulty] === diff);
      return acc;
    },
    {} as Record<string, typeof questions>
  );

  // Fallback: if Chinese mapping yields nothing, try direct match
  const hasGrouped = difficulties.some((d) => grouped[d].length > 0);
  if (!hasGrouped) {
    for (const q of questions) {
      const mapped = diffMap[q.difficulty.toLowerCase()] || "简单";
      if (!grouped[mapped]) grouped[mapped] = [];
      grouped[mapped].push(q);
    }
  }

  const diffColorMap: Record<string, string> = {
    "简单": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "中等": "bg-amber-100 text-amber-700 border-amber-200",
    "困难": "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {difficulties.map((diff) => (
          <button
            key={diff}
            type="button"
            onClick={() => setActiveDifficulty(diff)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeDifficulty === diff
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {diff}
            {grouped[diff]?.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">
                ({grouped[diff].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Questions for active difficulty */}
      <div className="space-y-3">
        {(grouped[activeDifficulty] || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            该难度暂无题目
          </p>
        ) : (
          (grouped[activeDifficulty] || []).map((q, i) => {
            const favId = `algorithmQuestions-${q.id || i}`;
            return (
            <div
              key={q.id || i}
              id={favId}
              className="relative rounded-lg border border-border/50 p-4 space-y-3 hover:shadow-sm transition-all"
            >
              <FavoriteButton
                isFavorited={isFavorited(favId)}
                onToggle={() =>
                  toggleFavorite({
                    id: favId,
                    sectionKey: "algorithmQuestions",
                    title: q.problem.slice(0, 80) + (q.problem.length > 80 ? "..." : ""),
                    subtitle: `${activeDifficulty} - ${q.examPoints}`,
                  })
                }
              />
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <div className="flex items-start gap-2 flex-wrap pr-8">
                    <p className="text-sm font-semibold text-foreground flex-1 whitespace-pre-wrap break-words">
                      {q.problem}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${diffColorMap[activeDifficulty] || ""}`}
                    >
                      {activeDifficulty}
                    </span>
                  </div>

                  {/* Test cases */}
                  {q.testCases?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">测试样例</p>
                      {q.testCases.map((tc, ti) => (
                        <div key={ti} className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                          {tc}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Exam points / Solution / Follow-up with colored backgrounds */}
                  <div className="grid gap-2 sm:grid-cols-3 text-xs">
                    <div className="rounded bg-blue-50 p-2">
                      <span className="font-medium text-blue-700">考察点:</span>{" "}
                      <span className="text-blue-800 whitespace-pre-wrap break-words">{q.examPoints}</span>
                    </div>
                    <div className="rounded bg-emerald-50 p-2">
                      <span className="font-medium text-emerald-700">解题思路:</span>{" "}
                      <span className="text-emerald-800 whitespace-pre-wrap break-words">{q.solutionApproach}</span>
                    </div>
                    <div className="rounded bg-violet-50 p-2">
                      <span className="font-medium text-violet-700">追问:</span>{" "}
                      <span className="text-violet-800 whitespace-pre-wrap break-words">{q.followUp}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
