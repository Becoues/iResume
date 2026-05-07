/**
 * Input length guards for resume / JD text.
 *
 * Single-user local context — the goal is "心里有数": warn when an upload
 * would burn an unusually large amount of tokens, hard-truncate egregious
 * cases so the LLM call doesn't blow the context window.
 *
 * Char counts are converted to estimated tokens with a conservative
 * 1 char ≈ 0.5 tokens factor. Chinese text is roughly 1:1 char:token; ASCII
 * is roughly 4:1, so 0.5 sits in between and over-estimates for English.
 */

// Hard caps — input above these gets truncated server-side
export const PDF_HARD_MAX_CHARS = 120_000;
export const JD_HARD_MAX_CHARS = 16_000;

// Soft thresholds — return a warning if exceeded (still accepted)
export const PDF_WARN_CHARS = 60_000;
export const JD_WARN_CHARS = 6_000;

// Used by the upload reject path — refuse files clearly outside the envelope
// (e.g. someone uploaded a 200-page book by accident).
export const PDF_ABSOLUTE_MAX_CHARS = 250_000;

export function estimateTokens(chars: number): number {
  return Math.round(chars * 0.5);
}

export interface InputCheckResult {
  /** Possibly-truncated text */
  pdfText: string;
  /** Possibly-truncated JD */
  jdText: string | null;
  /** Hard-truncations that occurred (always surface to the user) */
  truncations: string[];
  /** Soft-warnings — accepted but worth showing */
  warnings: string[];
  /** Estimated total prompt tokens for one analysis call (resume + JD) */
  estimatedPromptTokens: number;
  /** Estimated tokens for full analysis (10 modules each get the same input) */
  estimatedTotalTokens: number;
}

/**
 * Apply caps + emit warnings. Mutating in spirit but functional in shape:
 * returns the cleaned strings so the caller can persist them.
 */
export function checkAndTruncateInputs(
  rawPdf: string,
  rawJd: string | null,
): InputCheckResult {
  const truncations: string[] = [];
  const warnings: string[] = [];

  let pdfText = rawPdf;
  if (pdfText.length > PDF_HARD_MAX_CHARS) {
    pdfText = pdfText.slice(0, PDF_HARD_MAX_CHARS);
    truncations.push(
      `简历文本超过硬上限 (${PDF_HARD_MAX_CHARS} 字符)，已截断到前 ${PDF_HARD_MAX_CHARS} 字符。原文 ${rawPdf.length} 字符。`,
    );
  } else if (pdfText.length > PDF_WARN_CHARS) {
    warnings.push(
      `简历文本较长 (${pdfText.length} 字符)，预计单次分析消耗 ~${estimateTokens(pdfText.length)} input tokens × 10 模块 = ~${estimateTokens(pdfText.length) * 10} tokens。`,
    );
  }

  let jdText = rawJd;
  if (jdText) {
    if (jdText.length > JD_HARD_MAX_CHARS) {
      const original = jdText.length;
      jdText = jdText.slice(0, JD_HARD_MAX_CHARS);
      truncations.push(
        `JD 文本超过硬上限 (${JD_HARD_MAX_CHARS} 字符)，已截断到前 ${JD_HARD_MAX_CHARS} 字符。原文 ${original} 字符。`,
      );
    } else if (jdText.length > JD_WARN_CHARS) {
      warnings.push(
        `JD 文本较长 (${jdText.length} 字符)，建议精简到职位关键要求。`,
      );
    }
  }

  const inputChars = pdfText.length + (jdText?.length ?? 0);
  const estimatedPromptTokens = estimateTokens(inputChars);
  // Each of 10 modules sends the full pdfText + jd as input. Prompt overhead
  // (system + framework instructions) adds another ~2000 tokens per call.
  const estimatedTotalTokens = (estimatedPromptTokens + 2000) * 10;

  return {
    pdfText,
    jdText,
    truncations,
    warnings,
    estimatedPromptTokens,
    estimatedTotalTokens,
  };
}
