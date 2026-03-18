/**
 * Analysis module definitions — shared between frontend and backend.
 */

export interface AnalysisModule {
  id: number;
  key: string;
  label: string;
  desc: string;
  icon: string;
  required: boolean;
  /** Which ResumeAnalysis keys this module produces */
  outputKeys: string[];
}

export const ANALYSIS_MODULES: AnalysisModule[] = [
  { id: 0, key: "candidateProfile", label: "候选人档案", desc: "基本信息与综合评分卡", icon: "👤", required: true, outputKeys: ["candidateProfile", "scoreCard"] },
  { id: 1, key: "architectureScoring", label: "四层架构评分", desc: "UI/算法/算力/经验四层评估", icon: "📊", required: false, outputKeys: ["architectureScoring"] },
  { id: 2, key: "dnaFitness", label: "DNA适配度", desc: "六维DNA文化匹配评估", icon: "🧬", required: false, outputKeys: ["dnaFitness"] },
  { id: 3, key: "capabilityMatrix", label: "能力矩阵", desc: "JD要求匹配评估", icon: "🎯", required: false, outputKeys: ["capabilityMatrix"] },
  { id: 4, key: "claimsAudit", label: "技术审计", desc: "简历声明反注水核查", icon: "🛡️", required: false, outputKeys: ["claimsAudit"] },
  { id: 5, key: "projectAnalysis", label: "项目解析", desc: "逐项目深度分析", icon: "🔀", required: false, outputKeys: ["projectAnalysis"] },
  { id: 6, key: "assessmentFramework", label: "考察框架", desc: "权重/优势/风险/验证点", icon: "📐", required: false, outputKeys: ["assessmentFramework"] },
  { id: 7, key: "technicalQuestions", label: "技术问题", desc: "15道技术面试题", icon: "❓", required: false, outputKeys: ["technicalQuestions"] },
  { id: 8, key: "algorithmQuestions", label: "算法题", desc: "9道算法题", icon: "💻", required: false, outputKeys: ["algorithmQuestions"] },
  { id: 9, key: "keyObservations", label: "关键观察", desc: "多维度关键发现", icon: "👁️", required: false, outputKeys: ["keyObservations"] },
];
