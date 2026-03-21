/**
 * Auto-tag a resume as 校招 / 实习 / 社招 based on LLM analysis and resume text.
 *
 * Priority:
 *   1. levelMatch field from LLM analysis (highest confidence)
 *   2. Resume text keyword matching (fallback)
 *   3. null if no match (user picks manually)
 */
export type ResumeTag = "校招" | "实习" | "社招";

interface TagContext {
  pdfText: string;
  experienceYears?: string | null;
  levelMatch?: string | null;
}

export function autoDetectTag(ctx: TagContext): ResumeTag | null {
  const level = ctx.levelMatch ?? "";
  const exp = ctx.experienceYears ?? "";

  // ── Priority 1: LLM levelMatch field (most reliable) ──
  if (/实习/.test(level)) return "实习";
  if (/应届|校招/.test(level)) return "校招";
  if (/社招|高级|资深|专家|架构师|总监/.test(level)) return "社招";

  // ── Priority 2: experienceYears field ──
  if (/应届|0年?$/.test(exp)) return "校招";
  const yearsNum = parseFloat(exp);
  if (!isNaN(yearsNum) && yearsNum >= 2) return "社招";

  // ── Priority 3: Resume text keywords ──
  const text = ctx.pdfText;

  if (/实习生?|intern/i.test(text)) return "实习";
  if (/应届|校招|校园招聘|在读|在校/.test(text)) return "校招";

  // Check graduation year proximity
  const currentYear = new Date().getFullYear();
  const gradMatch = text.match(/(?:预计|expected)?(?:毕业|graduation).*?(\d{4})/i);
  if (gradMatch) {
    const gradYear = parseInt(gradMatch[1], 10);
    if (gradYear >= currentYear && gradYear <= currentYear + 1) return "校招";
  }

  // No confident match → return null (user picks manually)
  return null;
}
