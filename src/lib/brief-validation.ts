import { z } from "zod";
import type { CandidateBrief } from "./prep-contract";

const short = z.string().trim().min(1).max(800);
const evidence = z.object({
  quote: z.string().trim().min(2).max(1200),
  verified: z.boolean().optional(),
});
const question = z.object({
  id: z.string().min(1).max(60),
  question: short,
  purpose: short,
  evidence,
  listenFor: z.array(short).min(1).max(5),
  followUps: z.array(short).min(1).max(5),
  priority: z.enum(["high", "medium"]).optional(),
  dimension: short.optional(),
});
const schema = z.object({
  version: z.literal(1),
  candidate: z.object({
    name: short,
    headline: short,
    experience: short,
    skills: z.array(short).max(12),
  }),
  summary: short,
  fitSummary: short,
  highlights: z
    .array(z.object({ title: short, detail: short, evidence }))
    .max(3)
    .optional(),
  capabilities: z
    .array(
      z.object({
        dimension: short,
        observation: short,
        verification: short,
        evidence,
      }),
    )
    .max(5)
    .optional(),
  experiences: z
    .array(
      z.object({
        title: short,
        relevance: short,
        evidence,
        contribution: short.optional(),
        challenge: short.optional(),
        approach: short.optional(),
        results: short.optional(),
      }),
    )
    .max(3),
  verificationPoints: z
    .array(z.object({ title: short, reason: short, evidence }))
    .max(3),
  questions: z.array(question).min(3).max(12),
  uncertainties: z.array(short).max(8),
});
export type BriefMode = "quick" | "deep";
export function parseJson(text: string): unknown {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(clean);
}
export function parseBrief(
  text: string,
  source: string,
  mode: BriefMode,
): CandidateBrief {
  const parsed = schema.parse(parseJson(text));
  if (mode === "quick" && parsed.questions.length > 5)
    throw new Error("快速简报需要 3–5 道问题");
  if (mode === "deep" && parsed.questions.length < 6)
    throw new Error("深入准备需要至少 6 道问题");
  const ids = new Set(parsed.questions.map((q) => q.id));
  if (ids.size !== parsed.questions.length) throw new Error("问题 ID 重复");
  for (const item of [
    ...(parsed.highlights ?? []),
    ...(parsed.capabilities ?? []),
    ...parsed.experiences,
    ...parsed.verificationPoints,
    ...parsed.questions,
  ]) {
    if (!source.includes(item.evidence.quote))
      throw new Error("引用必须逐字来自简历原文");
    item.evidence.verified = true;
  }
  return parsed as CandidateBrief;
}
export type BriefCompletion = (
  repair: string | undefined,
  signal: AbortSignal,
) => Promise<string>;
export async function generateValidatedBrief(options: {
  source: string;
  mode: BriefMode;
  complete: BriefCompletion;
  timeoutMs?: number;
}): Promise<CandidateBrief> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("生成超时，请稍后重试"));
    }, options.timeoutMs ?? 90_000);
  });
  const work = async () => {
    let repair: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await options.complete(repair, controller.signal);
      if (controller.signal.aborted) throw new Error("生成超时，请稍后重试");
      try {
        return parseBrief(text, options.source, options.mode);
      } catch {
        repair =
          "上次输出未通过结构或证据校验。请从头重新生成完全符合 JSON 结构的答案，每条 evidence.quote 必须是简历原文的连续逐字片段，不得改写或来自 JD。";
      }
    }
    throw new Error("模型输出未通过结构或原文引用校验，请重试或更换模型");
  };
  try {
    return await Promise.race([work(), deadline]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
