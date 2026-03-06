export interface ResumeAnalysis {
  candidateProfile: CandidateProfile;
  architectureScoring: ArchitectureScoring;
  dnaFitness: DnaFitness;
  capabilityMatrix: CapabilityMatchEntry[];
  claimsAudit: ClaimAudit[];
  projectAnalysis: ProjectDeepAnalysis[];
  assessmentFramework: AssessmentFramework;
  technicalQuestions: TechnicalQuestion[];
  algorithmQuestions: AlgorithmQuestion[];
  keyObservations: KeyObservation[];
  scoreCard: ScoreCard;
}

export interface AlgorithmQuestion {
  id: number;
  difficulty: "easy" | "medium" | "hard";
  problem: string;
  testCases: string[];
  examPoints: string;
  solutionApproach: string;
  followUp: string;
}

export interface CandidateProfile {
  name: string;
  techDirection: string;
  experienceYears: string;
  levelMatch: string;
  techStack: TechStackItem[];
}

export interface TechStackItem {
  name: string;
  level: "expert" | "proficient" | "familiar";
  evidence: string;
}

export interface ArchitectureScoring {
  ui: ScoreWithDetail;
  algorithm: ScoreWithDetail;
  computingPower: ScoreWithDetail;
  database: ScoreWithDetail;
  summary: string;
}

export interface ScoreWithDetail {
  score: number;
  evidence: string;
  credibility: string;
  risk: string;
}

export interface DnaFitness {
  dimensions: DnaDimension[];
  summary: string;
  topStrengths: string[];
  topRisks: string[];
}

export interface DnaDimension {
  name: string;
  score: number;
  evidence: string;
  risk: string;
  verificationPoint: string;
}

export interface CapabilityMatchEntry {
  jdRequirement: string;
  matchLevel: "strong" | "partial" | "weak" | "missing";
  verificationPriority: "high" | "medium" | "low";
  evidence: string;
  riskNote: string;
}

export interface ClaimAudit {
  claim: string;
  suspiciousPoint: string;
  verificationDirection: string;
  criteria: string;
}

export interface ProjectDeepAnalysis {
  projectName: string;
  period: string;
  background: string;
  successMetrics: string;
  architectureDescription: string;
  techQuestions: TechQuestion[];
  contradictions: Contradiction[];
  decisionTree: DecisionBranch[];
  results: string;
  mustAskQuestions: string[];
}

export interface TechQuestion {
  question: string;
  expectedKeywords: string[];
}

export interface Contradiction {
  description: string;
  reason: string;
  possibleTruth: string;
}

export interface DecisionBranch {
  choice: string;
  branches: { question: string; keyPoints: string }[];
}

export interface AssessmentFramework {
  weights: { dimension: string; weight: string; reason: string }[];
  topStrengths: string[];
  topRisks: string[];
  topVerificationPoints: string[];
}

export interface TechnicalQuestion {
  id: number;
  level: "basic" | "intermediate" | "expert";
  question: string;
  examPoint: string;
  expectedPoints: string;
  followUp: string;
}

export interface KeyObservation {
  dimension: string;
  rating: string;
  detail: string;
}

export interface ScoreCard {
  architectureTotal: number;
  dnaTotal: number;
  finalScore: number;
  recommendation:
    | "strong_recommend"
    | "recommend"
    | "conditional"
    | "not_recommend";
  highlight: string;
  risk: string;
  mustAskQuestion: string;
}

// Resume DB record type
export interface ResumeRecord {
  id: string;
  filename: string;
  uploadDate: string;
  pdfText: string;
  jdText: string | null;
  analysisJson: string | null;
  status: "uploaded" | "analyzing" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
