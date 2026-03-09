import type { ResumeAnalysis } from "@/lib/types";

/**
 * Post-process LLM scores to:
 * 1. Recalculate architectureTotal and dnaTotal from actual sub-scores
 * 2. Recompute finalScore with a spreading function to avoid clustering
 * 3. Re-derive recommendation from the recalculated score
 *
 * Mutates the analysis object in place.
 */
export function postProcessScores(analysis: ResumeAnalysis): void {
  const sc = analysis.scoreCard;
  if (!sc) return;

  // --- 1. Recalculate sub-totals from actual dimension scores ---
  const arch = analysis.architectureScoring;
  if (arch) {
    const archScore =
      (arch.ui?.score ?? 0) +
      (arch.algorithm?.score ?? 0) +
      (arch.computingPower?.score ?? 0) +
      (arch.database?.score ?? 0);
    sc.architectureTotal = Math.round(archScore * 10) / 10; // max 20
  }

  const dna = analysis.dnaFitness;
  if (dna?.dimensions?.length) {
    const dnaScore = dna.dimensions.reduce((sum, d) => sum + (d.score ?? 0), 0);
    sc.dnaTotal = Math.round(dnaScore * 10) / 10; // max 30
  }

  // --- 2. Recalculate finalScore from sub-totals ---
  // Architecture (max 20) weighted 40%, DNA (max 30) weighted 30%,
  // original LLM score weighted 30% (captures soft factors).
  const archPct = sc.architectureTotal / 20; // 0-1
  const dnaPct = sc.dnaTotal / 30;           // 0-1
  const llmPct = sc.finalScore / 100;        // 0-1

  const rawScore = archPct * 0.4 + dnaPct * 0.3 + llmPct * 0.3;

  // --- 3. Spread the distribution ---
  // Apply a power curve centered at 0.5 to amplify differences.
  // Scores above 0.5 get pushed higher, below get pushed lower.
  // spreadFactor < 1 compresses, > 1 spreads. We use 1.6 for good separation.
  const spread = spreadScore(rawScore, 1.6);
  sc.finalScore = Math.round(spread * 100);

  // Clamp to 0-100
  sc.finalScore = Math.max(0, Math.min(100, sc.finalScore));

  // --- 4. Re-derive recommendation from new score ---
  if (sc.finalScore >= 85) {
    sc.recommendation = "strong_recommend";
  } else if (sc.finalScore >= 70) {
    sc.recommendation = "recommend";
  } else if (sc.finalScore >= 50) {
    sc.recommendation = "conditional";
  } else {
    sc.recommendation = "not_recommend";
  }
}

/**
 * Spread score distribution using a symmetric power curve around midpoint.
 * Input and output are both in [0, 1].
 */
function spreadScore(x: number, factor: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Map to [-1, 1], apply signed power, map back to [0, 1]
  const centered = x * 2 - 1; // [-1, 1]
  const sign = centered >= 0 ? 1 : -1;
  const stretched = sign * Math.pow(Math.abs(centered), 1 / factor);
  return (stretched + 1) / 2;
}
