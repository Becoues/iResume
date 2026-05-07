import { z } from "zod";

/**
 * Per-module zod schemas for LLM output validation.
 *
 * Lenient by design: each module's prompt instructs the LLM to return a JSON
 * object containing specific keys (its outputKeys). We validate the *shape*
 * but accept loose nested content — the LLM occasionally drops fields or
 * miscasts numbers as strings, and being too strict would force unnecessary
 * retries on otherwise usable output.
 *
 * On failure, validateModuleOutput returns { ok: false, error } so the
 * analyze route can mark just that module as failed (module-level isolation).
 */

// ---------------------------------------------------------------------------
// Leaf types
// ---------------------------------------------------------------------------

const TechStackItem = z.object({
  name: z.string().min(1),
  level: z.string(),
  evidence: z.string().optional().default(""),
}).passthrough();

const CandidateProfile = z.object({
  name: z.string().optional().default(""),
  techDirection: z.string().optional().default(""),
  experienceYears: z.string().optional().default(""),
  levelMatch: z.string().optional().default(""),
  techStack: z.array(TechStackItem).optional().default([]),
}).passthrough();

const ScoreCard = z.object({
  architectureTotal: z.coerce.number().optional().default(0),
  dnaTotal: z.coerce.number().optional().default(0),
  finalScore: z.coerce.number().optional().default(0),
  recommendation: z.string().optional().default(""),
  highlight: z.string().optional().default(""),
  risk: z.string().optional().default(""),
  mustAskQuestion: z.string().optional().default(""),
}).passthrough();

const ScoreWithDetail = z.object({
  score: z.coerce.number(),
  evidence: z.string().optional().default(""),
  credibility: z.string().optional().default(""),
  risk: z.string().optional().default(""),
}).passthrough();

const ArchitectureScoring = z.object({
  ui: ScoreWithDetail,
  algorithm: ScoreWithDetail,
  computingPower: ScoreWithDetail,
  database: ScoreWithDetail,
  summary: z.string().optional().default(""),
}).passthrough();

const DnaDimension = z.object({
  name: z.string(),
  score: z.coerce.number(),
  evidence: z.string().optional().default(""),
  risk: z.string().optional().default(""),
  verificationPoint: z.string().optional().default(""),
}).passthrough();

const DnaFitness = z.object({
  dimensions: z.array(DnaDimension),
  summary: z.string().optional().default(""),
  topStrengths: z.array(z.string()).optional().default([]),
  topRisks: z.array(z.string()).optional().default([]),
}).passthrough();

const CapabilityMatchEntry = z.object({
  jdRequirement: z.string(),
  matchLevel: z.string(),
  verificationPriority: z.string().optional().default(""),
  evidence: z.string().optional().default(""),
  riskNote: z.string().optional().default(""),
}).passthrough();

const ClaimAudit = z.object({
  claim: z.string(),
  suspiciousPoint: z.string().optional().default(""),
  verificationDirection: z.string().optional().default(""),
  criteria: z.string().optional().default(""),
}).passthrough();

const TechQuestion = z.object({
  question: z.string(),
  expectedKeywords: z.array(z.string()).optional().default([]),
}).passthrough();

const Contradiction = z.object({
  description: z.string(),
  reason: z.string().optional().default(""),
  possibleTruth: z.string().optional().default(""),
}).passthrough();

const DecisionBranch = z.object({
  choice: z.string(),
  branches: z.array(z.object({
    question: z.string(),
    keyPoints: z.string().optional().default(""),
  }).passthrough()).optional().default([]),
}).passthrough();

const ProjectDeepAnalysis = z.object({
  projectName: z.string(),
  period: z.string().optional().default(""),
  background: z.string().optional().default(""),
  successMetrics: z.string().optional().default(""),
  architectureDescription: z.string().optional().default(""),
  techQuestions: z.array(TechQuestion).optional().default([]),
  contradictions: z.array(Contradiction).optional().default([]),
  decisionTree: z.array(DecisionBranch).optional().default([]),
  results: z.string().optional().default(""),
  mustAskQuestions: z.array(z.string()).optional().default([]),
}).passthrough();

const AssessmentFramework = z.object({
  weights: z.array(z.object({
    dimension: z.string(),
    weight: z.string().optional().default(""),
    reason: z.string().optional().default(""),
  }).passthrough()).optional().default([]),
  topStrengths: z.array(z.string()).optional().default([]),
  topRisks: z.array(z.string()).optional().default([]),
  topVerificationPoints: z.array(z.string()).optional().default([]),
}).passthrough();

const TechnicalQuestion = z.object({
  id: z.coerce.number().optional(),
  level: z.string(),
  question: z.string(),
  examPoint: z.string().optional().default(""),
  expectedPoints: z.string().optional().default(""),
  followUp: z.string().optional().default(""),
}).passthrough();

const AlgorithmQuestion = z.object({
  id: z.coerce.number().optional(),
  difficulty: z.string(),
  problem: z.string(),
  testCases: z.array(z.string()).optional().default([]),
  examPoints: z.string().optional().default(""),
  solutionApproach: z.string().optional().default(""),
  followUp: z.string().optional().default(""),
}).passthrough();

const KeyObservation = z.object({
  dimension: z.string(),
  rating: z.string().optional().default(""),
  detail: z.string().optional().default(""),
}).passthrough();

// ---------------------------------------------------------------------------
// Per-module envelope schemas — each matches what one module's prompt returns
// ---------------------------------------------------------------------------

const ModuleSchemas: Record<string, z.ZodTypeAny> = {
  candidateProfile: z.object({
    candidateProfile: CandidateProfile,
    scoreCard: ScoreCard,
  }).passthrough(),

  architectureScoring: z.object({
    architectureScoring: ArchitectureScoring,
  }).passthrough(),

  dnaFitness: z.object({
    dnaFitness: DnaFitness,
  }).passthrough(),

  capabilityMatrix: z.object({
    capabilityMatrix: z.array(CapabilityMatchEntry),
  }).passthrough(),

  claimsAudit: z.object({
    claimsAudit: z.array(ClaimAudit),
  }).passthrough(),

  projectAnalysis: z.object({
    projectAnalysis: z.array(ProjectDeepAnalysis),
  }).passthrough(),

  assessmentFramework: z.object({
    assessmentFramework: AssessmentFramework,
  }).passthrough(),

  technicalQuestions: z.object({
    technicalQuestions: z.array(TechnicalQuestion),
  }).passthrough(),

  algorithmQuestions: z.object({
    algorithmQuestions: z.array(AlgorithmQuestion),
  }).passthrough(),

  keyObservations: z.object({
    keyObservations: z.array(KeyObservation),
  }).passthrough(),
};

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validate parsed JSON against a module's expected envelope schema.
 * Unknown moduleKeys pass through untouched (forward compat).
 */
export function validateModuleOutput(
  moduleKey: string,
  parsed: unknown,
): ValidationResult {
  const schema = ModuleSchemas[moduleKey];
  if (!schema) {
    return { ok: true, value: (parsed ?? {}) as Record<string, unknown> };
  }

  const result = schema.safeParse(parsed);
  if (result.success) {
    return { ok: true, value: result.data as Record<string, unknown> };
  }

  // Compose a compact error message from the first 3 issues — full zod
  // errors are too noisy for the UI errorMessage column.
  const issues = result.error.issues.slice(0, 3).map((i) => {
    const path = i.path.join(".") || "(root)";
    return `${path}: ${i.message}`;
  });
  return { ok: false, error: `LLM 输出结构校验失败: ${issues.join("; ")}` };
}
