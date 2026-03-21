/**
 * Auto-tag a resume as 校招 / 实习 / 社招 based on resume text and analysis data.
 *
 * Priority: 实习 > 校招 > 社招 (default)
 */
export type ResumeTag = "校招" | "实习" | "社招";

interface TagContext {
  pdfText: string;
  experienceYears?: string | null;
  levelMatch?: string | null;
}

const INTERN_KEYWORDS = [
  "实习", "intern", "internship", "实习生", "暑期实习", "日常实习",
  "寒假实习", "春招实习", "秋招实习",
];

const CAMPUS_KEYWORDS = [
  "应届", "校招", "校园招聘", "毕业", "在校", "在读",
  "本科在读", "研究生在读", "硕士在读", "博士在读",
  "campus", "fresh graduate", "new grad",
  "预计毕业", "expected graduation",
];

export function autoDetectTag(ctx: TagContext): ResumeTag {
  const text = ctx.pdfText.toLowerCase();
  const exp = ctx.experienceYears?.toLowerCase() ?? "";
  const level = ctx.levelMatch?.toLowerCase() ?? "";

  // Check for intern signals
  if (INTERN_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) {
    return "实习";
  }
  if (level.includes("实习")) {
    return "实习";
  }

  // Check for campus recruitment signals
  if (CAMPUS_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) {
    return "校招";
  }
  if (exp === "应届" || exp === "0" || exp === "0年") {
    return "校招";
  }
  if (level.includes("应届") || level.includes("校招")) {
    return "校招";
  }

  // Check graduation year proximity (within 1 year of current)
  const currentYear = new Date().getFullYear();
  const gradYearMatch = ctx.pdfText.match(
    /(?:预计|expected)?(?:毕业|graduation|graduating).*?(\d{4})/i
  );
  if (gradYearMatch) {
    const gradYear = parseInt(gradYearMatch[1], 10);
    if (gradYear >= currentYear && gradYear <= currentYear + 1) {
      return "校招";
    }
  }

  // Default: social recruitment
  return "社招";
}
