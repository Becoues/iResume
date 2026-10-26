/** Browser-safe contracts shared by the briefing UI, ingestion and AI runtime. */
export interface EvidenceItem {
  quote: string;
  verified: boolean;
}
export interface PrepQuestion {
  id: string;
  question: string;
  purpose: string;
  evidence: EvidenceItem;
  listenFor: string[];
  followUps: string[];
}
export interface CandidateBrief {
  version: 1;
  candidate: {
    name: string;
    headline: string;
    experience: string;
    skills: string[];
  };
  summary: string;
  fitSummary: string;
  experiences: {
    title: string;
    relevance: string;
    evidence: EvidenceItem;
  }[];
  verificationPoints: {
    title: string;
    reason: string;
    evidence: EvidenceItem;
  }[];
  questions: PrepQuestion[];
  uncertainties: string[];
}
export type BriefStatus = "idle" | "running" | "completed" | "failed";
export interface BriefRunInfo {
  id: string;
  status: string;
  mode: string;
  createdAt: string;
  completedAt?: string | null;
  model?: string | null;
  provider?: string | null;
}
export interface PrepResume {
  id: string;
  filename: string;
  pdfText: string;
  jdText: string | null;
  sourceType?: string;
  status: string;
  uploadDate: string;
  brief: CandidateBrief | null;
  briefStatus: BriefStatus;
  briefError: string | null;
  briefRun: BriefRunInfo | null;
  /** Successful run behind the displayed brief, separate from a newer failed attempt. */
  briefResultRun?: BriefRunInfo | null;
  analysisJson?: unknown;
}
export type AiProvider = "CometAPI" | "OpenAI-compatible" | "Bedrock";
export interface AiSettings {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  region: string;
  authMode: "default" | "apiKey";
  apiKey?: string;
  bedrockApiKey?: string;
  hasApiKey?: boolean;
  hasBedrockApiKey?: boolean;
  configured?: boolean;
  clearApiKey?: boolean;
  clearBedrockApiKey?: boolean;
}
