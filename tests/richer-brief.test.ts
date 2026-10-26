import test from "node:test";
import assert from "node:assert/strict";
import { parseBrief } from "../src/lib/brief-validation";
import type { CandidateBrief } from "../src/lib/prep-contract";

const source =
  "张明负责支付系统，使用 TypeScript 重构接口，延迟减少 30%。推动统一监控，补充告警流程。";

function legacyBrief(): CandidateBrief {
  return {
    version: 1,
    candidate: {
      name: "张明",
      headline: "后端工程师",
      experience: "未提供",
      skills: ["TypeScript"],
    },
    summary: "负责支付系统和统一监控。",
    fitSummary: "未提供 JD，暂不评价岗位匹配。",
    experiences: [
      {
        title: "支付系统",
        relevance: "核实接口改造的个人贡献",
        evidence: { quote: "使用 TypeScript 重构接口", verified: false },
      },
    ],
    verificationPoints: [],
    questions: [1, 2, 3].map((id) => ({
      id: `q${id}`,
      question: "延迟降低是如何测量的？",
      purpose: "核实结果口径",
      evidence: { quote: "延迟减少 30%", verified: false },
      listenFor: ["对照基线"],
      followUps: ["测量窗口是什么？"],
    })),
    uncertainties: [],
  };
}

function richerBrief(): CandidateBrief {
  const value = legacyBrief();
  value.highlights = [
    {
      title: "接口优化有结果描述",
      detail: "简历提及延迟减少 30%，需核实基线和归因。",
      evidence: { quote: "延迟减少 30%", verified: false },
    },
  ];
  value.capabilities = [
    {
      dimension: "工程改进",
      observation: "有接口重构经历，方案取舍能力待验证。",
      verification: "请说明瓶颈定位、候选方案和选择依据。",
      evidence: { quote: "使用 TypeScript 重构接口", verified: false },
    },
  ];
  Object.assign(value.experiences[0], {
    contribution: "使用 TypeScript 重构接口",
    challenge: "简历未提供",
    approach: "简历未提供",
    results: "延迟减少 30%，测量口径未提供",
  });
  Object.assign(value.questions[0], {
    priority: "high",
    dimension: "结果验证",
  });
  return value;
}

test("richer fields survive parsing and new evidence is server verified", () => {
  const result = parseBrief(JSON.stringify(richerBrief()), source, "quick");
  assert.equal(result.highlights?.[0].title, "接口优化有结果描述");
  assert.equal(result.highlights?.[0].evidence.verified, true);
  assert.equal(result.capabilities?.[0].dimension, "工程改进");
  assert.equal(result.capabilities?.[0].evidence.verified, true);
  assert.equal(
    result.capabilities?.[0].verification,
    "请说明瓶颈定位、候选方案和选择依据。",
  );
  assert.equal(result.experiences[0].contribution, "使用 TypeScript 重构接口");
  assert.equal(result.experiences[0].challenge, "简历未提供");
  assert.equal(result.experiences[0].approach, "简历未提供");
  assert.equal(result.experiences[0].results, "延迟减少 30%，测量口径未提供");
  assert.equal(result.questions[0].priority, "high");
  assert.equal(result.questions[0].dimension, "结果验证");
});

test("highlights and capabilities reject invented or JD-only quotes even when marked verified", () => {
  for (const section of ["highlights", "capabilities"] as const) {
    const value = richerBrief();
    value[section]![0].evidence = {
      quote: "具有 Kubernetes 专家经验",
      verified: true,
    };
    assert.throws(
      () => parseBrief(JSON.stringify(value), source, "quick"),
      /引用必须逐字来自简历原文/,
    );
  }
});

test("optional richer content remains bounded and question priorities are validated", () => {
  const excessiveHighlights = richerBrief();
  excessiveHighlights.highlights = Array.from(
    { length: 4 },
    () => excessiveHighlights.highlights![0],
  );
  const excessiveCapabilities = richerBrief();
  excessiveCapabilities.capabilities = Array.from(
    { length: 6 },
    () => excessiveCapabilities.capabilities![0],
  );
  const oversizedDetail = richerBrief();
  oversizedDetail.experiences[0].contribution = "长".repeat(801);
  const invalidPriority = richerBrief();
  Object.assign(invalidPriority.questions[0], { priority: "critical" });
  for (const value of [
    excessiveHighlights,
    excessiveCapabilities,
    oversizedDetail,
    invalidPriority,
  ]) {
    assert.throws(() => parseBrief(JSON.stringify(value), source, "quick"));
  }
});

test("legacy version 1 brief stays valid without richer fields or longer answer guides", () => {
  const result = parseBrief(JSON.stringify(legacyBrief()), source, "quick");
  assert.equal(result.version, 1);
  assert.equal(result.highlights, undefined);
  assert.equal(result.capabilities, undefined);
  assert.equal(result.experiences[0].contribution, undefined);
  assert.equal(result.questions[0].priority, undefined);
  assert.deepEqual(result.questions[0].listenFor, ["对照基线"]);
  assert.equal(result.questions[0].evidence.verified, true);
});
