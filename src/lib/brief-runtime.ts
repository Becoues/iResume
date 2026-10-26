import { prisma } from "./db";
import {
  getRuntimeConfig,
  publicConfig,
  assertConfigured,
  type RuntimeConfig,
} from "./ai/config";
import { completeJson, publicError } from "./ai/client";
import { BRIEF_SYSTEM, briefPrompt } from "./ai/prompt";
import { generateValidatedBrief, type BriefMode } from "./brief-validation";
import type {
  CandidateBrief,
  BriefStatus,
  BriefRunInfo,
} from "./prep-contract";

export class BriefNotFoundError extends Error {}
const RUN_TIMEOUT_MS = 90_000;
const STALE_MS = RUN_TIMEOUT_MS + 30_000;
const publicRunSelect = {
  id: true,
  status: true,
  mode: true,
  createdAt: true,
  completedAt: true,
  provider: true,
  model: true,
} as const;
function runInfo(
  run: {
    id: string;
    status: string;
    mode: string;
    createdAt: Date;
    completedAt: Date | null;
    provider: string;
    model: string;
  } | null,
): BriefRunInfo | null {
  return run
    ? {
        ...run,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || null,
      }
    : null;
}
export async function getBriefState(id: string): Promise<{
  brief: CandidateBrief | null;
  briefStatus: BriefStatus;
  briefError: string | null;
  briefRun: BriefRunInfo | null;
  briefResultRun: BriefRunInfo | null;
}> {
  await recoverStaleRuns(id);
  const row = await prisma.resume.findUnique({
    where: { id },
    select: {
      briefJson: true,
      briefStatus: true,
      briefError: true,
      briefRunId: true,
    },
  });
  if (!row) throw new BriefNotFoundError("简历不存在");
  const [run, resultRun] = await Promise.all([
    row.briefRunId
      ? prisma.analysisRun.findUnique({
          where: { id: row.briefRunId },
          select: publicRunSelect,
        })
      : Promise.resolve(null),
    row.briefJson
      ? prisma.analysisRun.findFirst({
          where: { resumeId: id, status: "completed" },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: publicRunSelect,
        })
      : Promise.resolve(null),
  ]);
  let brief: CandidateBrief | null = null;
  try {
    if (row.briefJson) brief = JSON.parse(row.briefJson);
  } catch {
    /* Legacy/corrupt data is never served as a valid brief. */
  }
  return {
    brief,
    briefStatus: row.briefStatus as BriefStatus,
    briefError: row.briefError,
    briefRun: runInfo(run),
    briefResultRun: brief ? runInfo(resultRun) : null,
  };
}
export async function recoverStaleRuns(resumeId: string) {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.analysisRun.findMany({
    where: { resumeId, status: "running", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (!stale.length) return;
  await prisma.$transaction(async (tx) => {
    for (const run of stale) {
      const error = "上次生成超时或服务已重启，请重新生成；已有简报已保留";
      await tx.analysisRun.updateMany({
        where: { id: run.id, status: "running" },
        data: { status: "failed", error, completedAt: new Date() },
      });
      await tx.resume.updateMany({
        where: { id: resumeId, briefRunId: run.id, briefStatus: "running" },
        data: { briefStatus: "failed", briefError: error },
      });
    }
  });
}
/** Atomically claim a run; duplicate callers receive the same persisted run id. */
export async function claimBrief(
  id: string,
  mode: BriefMode,
  config: RuntimeConfig,
) {
  return prisma.$transaction(
    async (tx) => {
      // First statement writes, avoiding SQLite read-to-write lock upgrades under concurrency.
      const claim = await tx.resume.updateMany({
        where: { id, briefStatus: { not: "running" } },
        data: { briefStatus: "running", briefError: null },
      });
      const resume = await tx.resume.findUnique({ where: { id } });
      if (!resume) throw new BriefNotFoundError("简历不存在");
      if (!claim.count) {
        if (!resume.briefRunId) throw new Error("运行状态无效");
        return {
          runId: resume.briefRunId,
          status: "running",
          claimed: false,
          resume,
        };
      }
      const snapshot = publicConfig(config);
      const run = await tx.analysisRun.create({
        data: {
          resumeId: id,
          mode,
          provider: config.provider,
          model: config.model,
          configJson: JSON.stringify(snapshot),
        },
      });
      await tx.resume.update({ where: { id }, data: { briefRunId: run.id } });
      return { runId: run.id, status: "running", claimed: true, resume };
    },
    { timeout: 10_000, maxWait: 10_000 },
  );
}
/** A late response cannot overwrite a newer claim or a run already failed by recovery. */
export async function finishBrief(
  id: string,
  runId: string,
  result: CandidateBrief | null,
  error: string | null,
) {
  await prisma.$transaction(async (tx) => {
    const done = await tx.analysisRun.updateMany({
      where: { id: runId, resumeId: id, status: "running" },
      data: {
        status: result ? "completed" : "failed",
        resultJson: result ? JSON.stringify(result) : undefined,
        error,
        completedAt: new Date(),
      },
    });
    if (!done.count) return;
    await tx.resume.updateMany({
      where: { id, briefRunId: runId, briefStatus: "running" },
      data: {
        briefStatus: result ? "completed" : "failed",
        briefError: error,
        ...(result ? { briefJson: JSON.stringify(result) } : {}),
      },
    });
  });
}
export async function startBrief(id: string, mode: BriefMode = "quick") {
  const current = await getBriefState(id);
  if (current.briefStatus === "running" && current.briefRun)
    return { runId: current.briefRun.id, status: "running" };
  const config = await getRuntimeConfig();
  assertConfigured(config);
  const claim = await claimBrief(id, mode, config);
  if (claim.claimed) {
    const { pdfText, jdText } = claim.resume;
    void (async () => {
      try {
        const result = await generateValidatedBrief({
          source: pdfText,
          mode,
          timeoutMs: RUN_TIMEOUT_MS,
          complete: (repair, signal) =>
            completeJson(
              config,
              BRIEF_SYSTEM,
              briefPrompt(pdfText, jdText, mode, repair),
              signal,
              mode === "quick" ? 6500 : 10000,
            ),
        });
        await finishBrief(id, claim.runId, result, null);
      } catch (error) {
        await finishBrief(id, claim.runId, null, publicError(error));
      }
    })().catch(() => {
      /* Database outage: the persisted claim will be recovered on the next read. */
    });
  }
  return { runId: claim.runId, status: claim.status };
}
