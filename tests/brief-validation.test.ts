import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrief,
  generateValidatedBrief,
} from "../src/lib/brief-validation";
const source = "张明负责支付系统，使用 TypeScript 重构接口，延迟减少 30%。";
export function fixture() {
  return {
    version: 1,
    candidate: {
      name: "张明",
      headline: "后端工程师",
      experience: "支付系统",
      skills: ["TypeScript"],
    },
    summary: "负责支付接口",
    fitSummary: "需核实与岗位匹配程度",
    experiences: [
      {
        title: "支付",
        relevance: "接口经验",
        evidence: { quote: "使用 TypeScript 重构接口", verified: false },
      },
    ],
    verificationPoints: [],
    questions: [1, 2, 3].map((id) => ({
      id: String(id),
      question: "如何验证优化效果？",
      purpose: "核实个人贡献",
      evidence: { quote: "延迟减少 30%", verified: false },
      listenFor: ["测量口径"],
      followUps: ["具体负责哪一部分？"],
    })),
    uncertainties: [],
  };
}
test("quotes must be exact resume substrings and never inherit model verified flags", () => {
  const value = fixture();
  const result = parseBrief(JSON.stringify(value), source, "quick");
  assert.equal(result.questions[0].evidence.verified, true);
  value.questions[0].evidence = { quote: "延迟减少 90%", verified: true };
  assert.throws(
    () => parseBrief(JSON.stringify(value), source, "quick"),
    /引用/,
  );
});
test("JD content cannot be laundered into resume evidence", () => {
  const v = fixture();
  v.questions[0].evidence.quote = "熟悉 Kubernetes";
  assert.throws(() => parseBrief(JSON.stringify(v), source, "quick"));
});
test("quick brief rejects fewer than three questions and accepts fenced JSON", () => {
  assert.equal(
    parseBrief(
      "```json\n" + JSON.stringify(fixture()) + "\n```",
      source,
      "quick",
    ).questions.length,
    3,
  );
  const v = fixture();
  v.questions = [];
  assert.throws(() => parseBrief(JSON.stringify(v), source, "quick"));
});
test("one repair accepts a corrected result and repeated malformed output fails", async () => {
  let calls = 0;
  const out = await generateValidatedBrief({
    source,
    mode: "quick",
    timeoutMs: 1000,
    complete: async () =>
      ++calls === 1 ? "broken" : JSON.stringify(fixture()),
  });
  assert.equal(out.candidate.name, "张明");
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    generateValidatedBrief({
      source,
      mode: "quick",
      timeoutMs: 1000,
      complete: async () => {
        calls++;
        return "{}";
      },
    }),
  );
  assert.equal(calls, 2);
});
test("one total deadline applies even to a stuck provider", async () => {
  await assert.rejects(
    generateValidatedBrief({
      source,
      mode: "quick",
      timeoutMs: 20,
      complete: async () => new Promise(() => {}),
    }),
    /超时/,
  );
});
test("deep preparation must add questions beyond a quick brief", () => {
  const value = fixture();
  assert.throws(
    () => parseBrief(JSON.stringify(value), source, "deep"),
    /深入/,
  );
  value.questions.push(
    ...value.questions.map((question, index) => ({
      ...question,
      id: `deep-${index}`,
    })),
  );
  assert.equal(
    parseBrief(JSON.stringify(value), source, "deep").questions.length,
    6,
  );
});
