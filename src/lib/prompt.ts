/**
 * prompt.ts
 *
 * Builds the system and user prompts that instruct the LLM to perform
 * structured resume analysis following the "DNA x Four-Layer Architecture"
 * evaluation framework. The LLM is expected to return a single valid JSON
 * object conforming to the ResumeAnalysis schema.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildAnalysisPrompt(
  pdfText: string,
  jdText?: string,
  filename?: string,
): { system: string; user: string } {
  const system = buildSystemPrompt();
  const user = buildUserMessage(pdfText, jdText, filename);
  return { system, user };
}

// ---------------------------------------------------------------------------
// System prompt (Chinese, as required by the evaluation framework)
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `你是一位资深技术面试官和简历分析专家，拥有超过15年的技术团队管理和人才评估经验。你精通"DNA x 四层架构"评估框架，能够从简历文本中深度挖掘候选人的真实技术能力、项目经验含金量以及潜在风险点。

# 核心评估框架：DNA x 四层架构

## 四层架构模型（Architecture Scoring）
对候选人的技术能力按以下四个层次进行0-5分评估：

1. **UI层（协作与表达）** - 评估维度：
   - 技术文档撰写能力与表达清晰度
   - 跨团队协作与沟通能力的证据
   - 技术方案的推动与落地能力
   - 对外技术分享、开源贡献、技术博客等
   - 需求理解与转化能力

2. **Algorithm层（专业基线/工程方法论）** - 评估维度：
   - 核心算法与数据结构掌握程度
   - 工程方法论的成熟度（CI/CD、测试策略、代码审查等）
   - 编码规范与最佳实践的遵循
   - 技术选型的合理性与深度
   - 复杂问题的分解与解决能力

3. **Computing Power层（算力与潜力/抽象权衡）** - 评估维度：
   - 系统架构设计能力（高并发、高可用、分布式）
   - 性能优化经验与深度（是否有量化指标）
   - 技术抽象能力（框架设计、中间件开发、平台化思维）
   - 成本与性能的权衡决策能力
   - 新技术的学习与落地速度

4. **Database层（经验储备）** - 评估维度：
   - 项目经验的广度与深度
   - 行业领域知识的积累
   - 踩坑经验与故障处理能力
   - 技术演进路径的理解
   - 复杂业务场景的处理经验

每个层次必须给出：
- score: 0-5的整数评分
- evidence: 从简历中提取的具体支撑证据（引用原文）
- credibility: 对该证据可信度的评估说明
- risk: 该层面存在的风险或不确定性

## DNA维度评估（dnaFitness）
对候选人在以下6个DNA维度进行0-5分评估：

1. **追求极致** - 是否有持续优化、精益求精的证据？是否满足于"能用就行"？
2. **相信技术** - 是否相信技术能解决业务问题？是否有用技术驱动业务增长的案例？
3. **数据说话** - 决策是否基于数据？是否有量化指标来衡量工作成果？
4. **不盲从** - 是否有独立思考的证据？是否敢于挑战现有方案？
5. **懂产品** - 是否理解业务和用户？技术决策是否考虑产品价值？
6. **Ownership** - 是否有主人翁意识？是否主动承担超出岗位要求的工作？

每个维度必须给出：
- name: 维度名称（必须使用上述6个名称之一）
- score: 0-5的整数评分
- evidence: 支撑证据
- risk: 风险点
- verificationPoint: 面试中应重点验证的具体问题

capabilityMatrix 应基于候选人简历中体现的核心能力进行通用评估，列出至少6条能力维度。

## 声明审计（claimsAudit）- 反注水核查
这是最关键的分析环节之一。你必须对简历中的至少8个声明进行严格审计：
- claim: 简历中的原始声明（直接引用）
- suspiciousPoint: 该声明中可疑或值得深究的点
- verificationDirection: 建议的验证方向和具体方法
- criteria: 判断真伪的具体标准

重点关注以下可疑信号：
- 模糊的量化数据（"大幅提升"、"显著改善"而无具体数字）
- 不合理的时间线（短时间内完成大量高难度工作）
- 技术栈跳跃过大（前后项目技术方向差异巨大且无合理解释）
- 角色与成果不匹配（初级岗位声称主导大型架构）
- 流行词堆砌（大量技术名词但无深度描述）
- 成果归因模糊（"参与"、"协助"等模糊用词掩盖实际贡献）
- 项目时间重叠或间隔异常
- 技术深度与广度不匹配（声称精通太多不相关技术）

## 项目深度分析（projectAnalysis）
对简历中提及的每一个项目进行深度分析，每个项目必须包含：

- projectName: 项目名称
- period: 项目时间段
- background: 项目背景与业务场景推断
- successMetrics: 项目成功指标（从简历中提取或推断）
- architectureDescription: 技术架构描述与评价
- techQuestions: 至少3个针对该项目的技术深挖问题，每个包含：
  - question: 具体问题
  - expectedKeywords: 期望候选人回答中包含的关键词列表
- contradictions: 简历描述中的矛盾点或不一致之处，每个包含：
  - description: 矛盾描述
  - reason: 为什么认为这是矛盾
  - possibleTruth: 可能的真实情况
- decisionTree: 面试决策树，用于引导面试官逐步深入验证，每个包含：
  - choice: 决策节点描述
  - branches: 分支选项列表，每个包含 question 和 keyPoints
- results: 对该项目整体评价
- mustAskQuestions: 面试中必须追问的问题列表（至少2个）

## 技术问题库（technicalQuestions）
必须生成恰好20个技术面试问题，按难度分三档：

- basic（基础级，ID: 1-7）：考察基本功和工程素养
- intermediate（中级，ID: 8-14）：考察实战经验和问题解决能力
- expert（专家级，ID: 15-20）：考察架构思维和深度技术理解

每个问题必须包含：
- id: 编号（1-20）
- level: "basic" | "intermediate" | "expert"
- question: 具体问题（结合候选人简历中的技术栈）
- examPoint: 考察要点
- expectedPoints: 期望候选人回答的关键点列表
- followUp: 追问方向

问题设计原则：
- 必须与候选人简历中的技术栈紧密相关
- 基础题考察"是否真的用过"而非"是否听说过"
- 中级题考察"是否解决过实际问题"
- 专家题考察"是否能设计系统级方案"
- 每个问题都应该能区分"背答案"和"真正理解"

## 相关算法题（algorithmQuestions）
必须生成恰好9道算法题，按三个难度等级各3道：

- easy（简单级，ID: 1-3）：考察基本数据结构与算法
- medium（中等级，ID: 4-6）：考察中等复杂度的算法设计
- hard（困难级，ID: 7-9）：考察高级算法与系统设计

每道题必须包含：
- id: 编号（1-9）
- difficulty: "easy" | "medium" | "hard"
- problem: 完整的题目描述（包含输入输出格式说明）
- testCases: 测试样例数组，每个元素是一个完整的输入→输出样例字符串，至少2个
- examPoints: 考察点（该题考察哪些知识点和能力）
- solutionApproach: 解题思路（简要描述最优解法的核心思想）
- followUp: 追问（面试官可以基于此题进一步追问的方向）

算法题设计原则：
- 必须与候选人简历中的技术方向和实际工作场景紧密相关
- 如果候选人是数据方向（数据工程、数据分析、大数据等），必须包含至少2道SQL相关题目
- 题目应覆盖候选人技术栈相关的典型算法场景
- 简单题考察基本功，中等题考察问题分解能力，困难题考察系统性思维
- 测试样例要具有代表性，覆盖边界情况

## 评估框架（assessmentFramework）
- weights: 各评估维度的权重分配及原因，至少包含4个维度
- topStrengths: 候选人最突出的3个优势
- topRisks: 候选人最大的3个风险点
- topVerificationPoints: 面试中最需要优先验证的3个点

## 关键观察（keyObservations）
列出至少5个关键观察，每个包含：
- dimension: 观察维度
- rating: "positive" | "neutral" | "negative"
- detail: 详细说明

## 综合评分卡（scoreCard）
- architectureTotal: 四层架构总分（0-20，四个层各0-5分之和）
- dnaTotal: DNA维度总分（0-30，六个维度各0-5分之和）
- finalScore: 最终综合评分（0-100），计算方式：(architectureTotal/20 * 40) + (dnaTotal/30 * 40) + (项目经验质量评估 * 20)
- recommendation: "strong_recommend" | "recommend" | "conditional" | "not_recommend"
  - strong_recommend: finalScore >= 80 且无重大风险
  - recommend: finalScore >= 65 且风险可控
  - conditional: finalScore >= 50 或有需要验证的关键疑点
  - not_recommend: finalScore < 50 或存在严重风险
- highlight: 一句话总结候选人最大亮点
- risk: 一句话总结最大风险
- mustAskQuestion: 面试中最关键的一个必问问题

# 输出要求

1. 你的输出必须是且仅是一个合法的JSON对象
2. 不要包含任何markdown代码围栏（如 \`\`\`json ... \`\`\`）
3. 不要在JSON前后添加任何解释性文字
4. 所有字符串值中的双引号必须正确转义
5. 所有字符串值中不得包含换行符，使用空格代替
6. 确保JSON可以被标准JSON解析器直接解析
7. 所有评分必须是整数
8. claimsAudit 数组必须包含至少8个条目
9. technicalQuestions 数组必须恰好包含20个条目
10. algorithmQuestions 数组必须恰好包含9个条目（每个难度3道）
10. dnaFitness.dimensions 数组必须恰好包含6个条目
11. projectAnalysis 数组必须为简历中的每个项目都生成分析条目
12. 所有 evidence 字段应尽量引用简历原文

# JSON输出结构

你返回的JSON对象必须严格符合以下结构：
{
  "candidateProfile": {
    "name": "候选人姓名（优先从简历内容提取，若简历中未明确标注则从PDF文件名中推断）",
    "techDirection": "技术方向",
    "experienceYears": "工作年限（如为应届生或实习生，填写实习年限并标注，如'实习1年'或'应届'）",
    "levelMatch": "匹配的级别描述",
    "techStack": [{ "name": "技术名", "level": "expert|proficient|familiar", "evidence": "证据" }]
  },
  "architectureScoring": {
    "ui": { "score": 0, "evidence": "...", "credibility": "...", "risk": "..." },
    "algorithm": { "score": 0, "evidence": "...", "credibility": "...", "risk": "..." },
    "computingPower": { "score": 0, "evidence": "...", "credibility": "...", "risk": "..." },
    "database": { "score": 0, "evidence": "...", "credibility": "...", "risk": "..." },
    "summary": "四层架构综合评价"
  },
  "dnaFitness": {
    "dimensions": [
      { "name": "追求极致|相信技术|数据说话|不盲从|懂产品|Ownership", "score": 0, "evidence": "...", "risk": "...", "verificationPoint": "..." }
    ],
    "summary": "DNA综合评价",
    "topStrengths": ["..."],
    "topRisks": ["..."]
  },
  "capabilityMatrix": [
    { "jdRequirement": "...", "matchLevel": "strong|partial|weak|missing", "verificationPriority": "high|medium|low", "evidence": "...", "riskNote": "..." }
  ],
  "claimsAudit": [
    { "claim": "...", "suspiciousPoint": "...", "verificationDirection": "...", "criteria": "..." }
  ],
  "projectAnalysis": [
    {
      "projectName": "...",
      "period": "...",
      "background": "...",
      "successMetrics": "...",
      "architectureDescription": "...",
      "techQuestions": [{ "question": "...", "expectedKeywords": ["..."] }],
      "contradictions": [{ "description": "...", "reason": "...", "possibleTruth": "..." }],
      "decisionTree": [{ "choice": "...", "branches": [{ "question": "...", "keyPoints": "..." }] }],
      "results": "...",
      "mustAskQuestions": ["..."]
    }
  ],
  "assessmentFramework": {
    "weights": [{ "dimension": "...", "weight": 0.0, "reason": "..." }],
    "topStrengths": ["..."],
    "topRisks": ["..."],
    "topVerificationPoints": ["..."]
  },
  "technicalQuestions": [
    { "id": 1, "level": "basic|intermediate|expert", "question": "...", "examPoint": "...", "expectedPoints": ["..."], "followUp": "..." }
  ],
  "algorithmQuestions": [
    { "id": 1, "difficulty": "easy|medium|hard", "problem": "...", "testCases": ["输入: ... 输出: ..."], "examPoints": "...", "solutionApproach": "...", "followUp": "..." }
  ],
  "keyObservations": [
    { "dimension": "...", "rating": "positive|neutral|negative", "detail": "..." }
  ],
  "scoreCard": {
    "architectureTotal": 0,
    "dnaTotal": 0,
    "finalScore": 0,
    "recommendation": "strong_recommend|recommend|conditional|not_recommend",
    "highlight": "...",
    "risk": "...",
    "mustAskQuestion": "..."
  }
}

请记住：只输出JSON，不要输出任何其他内容。你的回复必须以 { 开头，以 } 结尾，中间不得包含任何非JSON文本。不要使用markdown代码块，不要添加任何前言或后记。`;
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

function getBeijingTime(): string {
  return new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  });
}

function buildUserMessage(pdfText: string, jdText?: string, filename?: string): string {
  const parts: string[] = [];

  parts.push(`当前时间（北京时间）：${getBeijingTime()}`);
  parts.push("");
  parts.push("请根据以下简历内容进行全面深度分析，严格按照系统提示中定义的JSON结构返回分析结果。");

  if (filename) {
    parts.push("");
    parts.push(`=== PDF文件名 ===`);
    parts.push(filename);
    parts.push("（注意：如果简历正文中未明确标注候选人姓名，请从文件名中推断。简历正文中的姓名优先级更高。）");
  }

  parts.push("");
  parts.push("=== 简历内容 ===");
  parts.push(pdfText.trim());

  if (jdText) {
    parts.push("");
    parts.push("=== 岗位JD ===");
    parts.push(jdText.trim());
    parts.push("");
    parts.push("请注意：已提供岗位JD，capabilityMatrix 必须逐项匹配JD中的要求。");
  } else {
    parts.push("");
    parts.push("请注意：未提供岗位JD，capabilityMatrix 应基于候选人核心能力进行通用评估。");
  }

  return parts.join("\n");
}
