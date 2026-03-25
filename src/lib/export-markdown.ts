/**
 * Convert each analysis module's data into Markdown text.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type A = Record<string, any>;

const REC_LABELS: Record<string, string> = {
  strong_recommend: "强烈推荐",
  recommend: "推荐",
  conditional: "有条件推荐",
  not_recommend: "不推荐",
};

const LEVEL_LABELS: Record<string, string> = {
  expert: "精通",
  proficient: "熟练",
  familiar: "了解",
};

const MATCH_LABELS: Record<string, string> = {
  strong: "强匹配",
  partial: "部分匹配",
  weak: "弱匹配",
  missing: "缺失",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

const QUESTION_LEVEL_LABELS: Record<string, string> = {
  basic: "基础",
  intermediate: "进阶",
  expert: "专家",
};

function scoreDetailBlock(label: string, d: A): string {
  return [
    `### ${label}（${d.score ?? "-"}/5）`,
    `- **证据**: ${d.evidence ?? "-"}`,
    `- **可信度**: ${d.credibility ?? "-"}`,
    `- **风险**: ${d.risk ?? "-"}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Per-module markdown generators
// ---------------------------------------------------------------------------

function candidateProfile(a: A): string {
  const cp = a.candidateProfile;
  const sc = a.scoreCard;
  const lines: string[] = [];

  if (sc) {
    lines.push(
      `## 综合评分: ${sc.finalScore ?? "-"}/100 — ${REC_LABELS[sc.recommendation] ?? sc.recommendation}`,
      "",
      `- 架构总分: ${sc.architectureTotal}/20`,
      `- DNA总分: ${sc.dnaTotal}/30`,
      `- 亮点: ${sc.highlight}`,
      `- 风险: ${sc.risk}`,
      `- 必问问题: ${sc.mustAskQuestion}`,
      "",
    );
  }

  if (cp) {
    lines.push(
      `## 候选人信息`,
      "",
      `| 字段 | 值 |`,
      `|------|------|`,
      `| 姓名 | ${cp.name} |`,
      `| 技术方向 | ${cp.techDirection} |`,
      `| 工作年限 | ${cp.experienceYears} |`,
      `| 层级匹配 | ${cp.levelMatch} |`,
      "",
    );

    if (cp.techStack?.length) {
      lines.push(`### 技术栈`, "", `| 技术 | 水平 | 证据 |`, `|------|------|------|`);
      for (const t of cp.techStack) {
        lines.push(`| ${t.name} | ${LEVEL_LABELS[t.level] ?? t.level} | ${t.evidence} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function architectureScoring(a: A): string {
  const arch = a.architectureScoring;
  if (!arch) return "";
  const dims = [
    ["UI层", arch.ui],
    ["算法层", arch.algorithm],
    ["算力层", arch.computingPower],
    ["数据库层", arch.database],
  ];
  const lines = dims.map(([label, d]) => scoreDetailBlock(label as string, d as A));
  if (arch.summary) lines.push(`\n## 总结\n${arch.summary}`);
  return lines.join("\n\n");
}

function dnaFitness(a: A): string {
  const dna = a.dnaFitness;
  if (!dna) return "";
  const lines: string[] = [];

  if (dna.dimensions?.length) {
    for (const d of dna.dimensions) {
      lines.push(
        `### ${d.name}（${d.score}/5）`,
        `- **证据**: ${d.evidence}`,
        `- **风险**: ${d.risk}`,
        `- **验证点**: ${d.verificationPoint}`,
        "",
      );
    }
  }

  if (dna.summary) lines.push(`## 总结\n${dna.summary}\n`);
  if (dna.topStrengths?.length) lines.push(`**优势**: ${dna.topStrengths.join("、")}\n`);
  if (dna.topRisks?.length) lines.push(`**风险**: ${dna.topRisks.join("、")}\n`);
  return lines.join("\n");
}

function capabilityMatrix(a: A): string {
  const items = a.capabilityMatrix;
  if (!items?.length) return "";
  const lines = [
    `| JD要求 | 匹配度 | 验证优先级 | 证据 | 风险 |`,
    `|--------|--------|------------|------|------|`,
  ];
  for (const c of items) {
    lines.push(
      `| ${c.jdRequirement} | ${MATCH_LABELS[c.matchLevel] ?? c.matchLevel} | ${c.verificationPriority} | ${c.evidence} | ${c.riskNote} |`,
    );
  }
  return lines.join("\n");
}

function claimsAudit(a: A): string {
  const items = a.claimsAudit;
  if (!items?.length) return "";
  const lines: string[] = [];
  for (const c of items) {
    lines.push(
      `### ${c.claim}`,
      `- **可疑点**: ${c.suspiciousPoint}`,
      `- **核实方向**: ${c.verificationDirection}`,
      `- **判定标准**: ${c.criteria}`,
      "",
    );
  }
  return lines.join("\n");
}

function projectAnalysis(a: A): string {
  const projects = a.projectAnalysis;
  if (!projects?.length) return "";
  const lines: string[] = [];
  for (const p of projects) {
    lines.push(`## ${p.projectName}`, "");
    if (p.period) lines.push(`**时间**: ${p.period}`);
    if (p.background) lines.push(`**背景**: ${p.background}`);
    if (p.successMetrics) lines.push(`**成功指标**: ${p.successMetrics}`);
    if (p.architectureDescription) lines.push(`**架构**: ${p.architectureDescription}`);
    if (p.results) lines.push(`**成果**: ${p.results}`);
    lines.push("");

    if (p.techQuestions?.length) {
      lines.push(`### 技术追问`);
      for (const q of p.techQuestions) {
        lines.push(`- **${q.question}**  \n  期望关键词: ${q.expectedKeywords?.join("、") ?? "-"}`);
      }
      lines.push("");
    }

    if (p.contradictions?.length) {
      lines.push(`### 矛盾点`);
      for (const c of p.contradictions) {
        lines.push(`- **${c.description}**  \n  原因: ${c.reason}  \n  可能真相: ${c.possibleTruth}`);
      }
      lines.push("");
    }

    if (p.mustAskQuestions?.length) {
      lines.push(`### 必问问题`);
      for (const q of p.mustAskQuestions) lines.push(`- ${q}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function assessmentFramework(a: A): string {
  const af = a.assessmentFramework;
  if (!af) return "";
  const lines: string[] = [];

  if (af.weights?.length) {
    lines.push(`## 权重分配`, "", `| 维度 | 权重 | 原因 |`, `|------|------|------|`);
    for (const w of af.weights) {
      lines.push(`| ${w.dimension} | ${w.weight} | ${w.reason} |`);
    }
    lines.push("");
  }

  if (af.topStrengths?.length) {
    lines.push(`## 核心优势`);
    for (const s of af.topStrengths) lines.push(`- ${s}`);
    lines.push("");
  }
  if (af.topRisks?.length) {
    lines.push(`## 核心风险`);
    for (const r of af.topRisks) lines.push(`- ${r}`);
    lines.push("");
  }
  if (af.topVerificationPoints?.length) {
    lines.push(`## 关键验证点`);
    for (const v of af.topVerificationPoints) lines.push(`- ${v}`);
    lines.push("");
  }
  return lines.join("\n");
}

function technicalQuestions(a: A): string {
  const qs = a.technicalQuestions;
  if (!qs?.length) return "";
  const lines: string[] = [];
  for (const q of qs) {
    lines.push(
      `### ${q.id}. [${QUESTION_LEVEL_LABELS[q.level] ?? q.level}] ${q.question}`,
      `- **考察点**: ${q.examPoint}`,
      `- **期望要点**: ${q.expectedPoints}`,
      `- **追问**: ${q.followUp}`,
      "",
    );
  }
  return lines.join("\n");
}

function algorithmQuestions(a: A): string {
  const qs = a.algorithmQuestions;
  if (!qs?.length) return "";
  const lines: string[] = [];
  for (const q of qs) {
    lines.push(
      `### ${q.id}. [${DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}] ${q.problem}`,
      `- **考察点**: ${q.examPoints}`,
      `- **解题思路**: ${q.solutionApproach}`,
      `- **追问**: ${q.followUp}`,
    );
    if (q.testCases?.length) {
      lines.push(`- **测试用例**:`);
      for (const tc of q.testCases) lines.push(`  - ${tc}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function keyObservations(a: A): string {
  const obs = a.keyObservations;
  if (!obs?.length) return "";
  const lines: string[] = [];
  for (const o of obs) {
    lines.push(`### ${o.dimension} — ${o.rating}`, `${o.detail}`, "");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const generators: Record<string, (a: A) => string> = {
  candidateProfile,
  architectureScoring,
  dnaFitness,
  capabilityMatrix,
  claimsAudit,
  projectAnalysis,
  assessmentFramework,
  technicalQuestions,
  algorithmQuestions,
  keyObservations,
};

const MODULE_TITLES: Record<string, string> = {
  candidateProfile: "候选人档案",
  architectureScoring: "四层架构评分",
  dnaFitness: "DNA适配度",
  capabilityMatrix: "能力矩阵",
  claimsAudit: "技术审计",
  projectAnalysis: "项目解析",
  assessmentFramework: "考察框架",
  technicalQuestions: "技术问题",
  algorithmQuestions: "算法题",
  keyObservations: "关键观察",
};

export function moduleToMarkdown(
  moduleKey: string,
  analysis: A,
  candidateName?: string,
): string {
  const title = MODULE_TITLES[moduleKey] ?? moduleKey;
  const header = candidateName
    ? `# ${candidateName} — ${title}\n\n`
    : `# ${title}\n\n`;
  const gen = generators[moduleKey];
  const body = gen ? gen(analysis) : "";
  return header + body;
}
