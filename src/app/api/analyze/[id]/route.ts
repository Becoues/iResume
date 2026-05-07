import { prisma } from "@/lib/db";
import { completion, addUsage, type TokenUsage } from "@/lib/openai";
import { buildModulePrompt } from "@/lib/prompt";
import { ANALYSIS_MODULES } from "@/lib/modules";
import { extractAndParseJSON } from "@/lib/json-utils";
import { validateModuleOutput } from "@/lib/schema";
import type { ResumeAnalysis } from "@/lib/types";
import { postProcessScores } from "@/lib/score-utils";
import { autoDetectTag } from "@/lib/auto-tag";
import { estimateCostUSD } from "@/lib/pricing";

/**
 * POST /api/analyze/[id]
 *
 * Runs selected analysis modules in parallel. Concurrency is capped at
 * ANALYZE_CONCURRENCY (default 5). Per-module failures are isolated:
 * only `candidateProfile` failure is fatal, other failures still produce
 * a `completed` analysis with the failed module names captured in
 * `errorMessage`, so the user can selectively re-run them.
 *
 * Request body (optional):
 *   { modules?: number[] }   — IDs of modules to run (default: all)
 *
 * SSE markers:
 *   data: [STARTED]           — all calls kicked off
 *   data: [DONE:moduleKey]    — one module completed successfully
 *   data: [FAIL:moduleKey]    — one module failed (non-fatal unless cp)
 *   data: [DONE]              — all modules settled, results persisted
 *
 * Status transitions:
 *   uploaded | failed | completed  ->  analyzing  ->  completed | failed
 */

const MAX_CONCURRENCY = Number(process.env.ANALYZE_CONCURRENCY) || 5;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "APIUserAbortError");
}

/** Run async tasks with a concurrency limit, exit early when signal aborts */
async function runWithConcurrency<T>(
  fns: (() => Promise<T>)[],
  limit: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = new Array(fns.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < fns.length) {
      if (signal?.aborted) return;
      const i = nextIndex++;
      results[i] = await fns[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, fns.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // -----------------------------------------------------------------------
  // 1. Load resume and validate
  // -----------------------------------------------------------------------
  const resume = await prisma.resume.findUnique({
    where: { id: params.id },
  });

  if (!resume) {
    return new Response(JSON.stringify({ error: "Resume not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!resume.pdfText || resume.pdfText.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Resume has no extracted text to analyze" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // -----------------------------------------------------------------------
  // 2. Parse selected modules from request body
  // -----------------------------------------------------------------------
  let selectedIds: number[];
  try {
    const body = await request.json();
    selectedIds = Array.isArray(body.modules)
      ? body.modules
      : ANALYSIS_MODULES.map((m) => m.id);
  } catch {
    selectedIds = ANALYSIS_MODULES.map((m) => m.id);
  }

  // Always include module 0 (candidateProfile)
  if (!selectedIds.includes(0)) selectedIds.unshift(0);

  const selectedModules = ANALYSIS_MODULES.filter((m) =>
    selectedIds.includes(m.id)
  );

  // -----------------------------------------------------------------------
  // 3. Mark as analyzing
  // -----------------------------------------------------------------------
  await prisma.resume.update({
    where: { id: params.id },
    data: { status: "analyzing", errorMessage: null },
  });

  // -----------------------------------------------------------------------
  // 4. Build prompts for selected modules
  // -----------------------------------------------------------------------
  const pdfText = resume.pdfText;
  const jdText = resume.jdText ?? undefined;
  const filename = resume.filename;

  const tasks = selectedModules.map((mod) => ({
    module: mod,
    prompt: buildModulePrompt(mod.key, pdfText, jdText, filename),
  }));

  // -----------------------------------------------------------------------
  // 5. Run all in parallel, report progress via SSE
  // -----------------------------------------------------------------------
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Bridge client disconnect → abort upstream LLM calls
  const abortCtl = new AbortController();
  const onClientAbort = () => abortCtl.abort();
  request.signal.addEventListener("abort", onClientAbort);

  // Best-effort SSE write — silently no-op if stream is already closed
  const safeWrite = async (chunk: string) => {
    if (abortCtl.signal.aborted) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      // stream closed by client
    }
  };

  // -----------------------------------------------------------------------
  // Track aggregate usage and timing across this run
  // -----------------------------------------------------------------------
  const runStartedAt = Date.now();
  let aggregateUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let runModel: string | null = null;

  (async () => {
    try {
      await safeWrite(`data: [STARTED]\n\n`);

      type ModuleResult =
        | { key: string; outputKeys: string[]; status: "ok"; parsed: Record<string, unknown> }
        | { key: string; outputKeys: string[]; status: "error"; error: string };

      const results = await runWithConcurrency<ModuleResult>(
        tasks.map(({ module: mod, prompt }) => async () => {
          try {
            const result = await completion(prompt.system, prompt.user, abortCtl.signal);
            aggregateUsage = addUsage(aggregateUsage, result.usage);
            runModel = result.model;
            const parsed = extractAndParseJSON(result.text);

            // Schema-validate the LLM output against this module's envelope.
            // On failure, treat as a module error (isolated per-module retry).
            const validation = validateModuleOutput(mod.key, parsed);
            if (!validation.ok) {
              console.error(`Module ${mod.key} schema validation failed:`, validation.error);
              await safeWrite(`data: [FAIL:${mod.key}]\n\n`);
              return { key: mod.key, outputKeys: mod.outputKeys, status: "error", error: validation.error };
            }

            await safeWrite(`data: [DONE:${mod.key}]\n\n`);
            return { key: mod.key, outputKeys: mod.outputKeys, status: "ok", parsed: validation.value };
          } catch (err) {
            if (isAbortError(err) || abortCtl.signal.aborted) {
              return { key: mod.key, outputKeys: mod.outputKeys, status: "error", error: "已取消" };
            }
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Module ${mod.key} failed for resume ${params.id}:`, err);
            await safeWrite(`data: [FAIL:${mod.key}]\n\n`);
            return { key: mod.key, outputKeys: mod.outputKeys, status: "error", error: msg };
          }
        }),
        MAX_CONCURRENCY,
        abortCtl.signal,
      );

      // -----------------------------------------------------------------
      // Client disconnected mid-flight — persist canceled state and exit.
      // -----------------------------------------------------------------
      if (abortCtl.signal.aborted) {
        console.warn(`[analyze:${params.id}] aborted by client`);
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: "已取消（客户端断开连接）",
          },
        });
        try { await writer.close(); } catch {}
        return;
      }

      // =================================================================
      // Merge per-module results, isolating failures
      // =================================================================

      // Start from existing analysis if re-analyzing
      let analysis: Partial<ResumeAnalysis> = {};
      if (resume.analysisJson) {
        try {
          analysis = JSON.parse(resume.analysisJson) as Partial<ResumeAnalysis>;
        } catch {
          // Start fresh if existing data is corrupt
        }
      }

      // Merge with previous moduleStatus so partial reruns preserve untouched modules
      let moduleStatus: Record<string, { status: "ok" | "error"; error?: string; lastRunAt: string }> = {};
      if (resume.moduleStatus) {
        try {
          moduleStatus = JSON.parse(resume.moduleStatus);
        } catch {
          moduleStatus = {};
        }
      }

      const failed: { key: string; error: string }[] = [];
      const nowIso = new Date().toISOString();

      for (const r of results) {
        if (r.status === "ok") {
          for (const outKey of r.outputKeys) {
            if (r.parsed[outKey] !== undefined) {
              (analysis as Record<string, unknown>)[outKey] = r.parsed[outKey];
            }
          }
          moduleStatus[r.key] = { status: "ok", lastRunAt: nowIso };
        } else {
          failed.push({ key: r.key, error: r.error });
          moduleStatus[r.key] = { status: "error", error: r.error, lastRunAt: nowIso };
        }
      }

      // Only candidateProfile failure is fatal — without it the whole analysis is meaningless
      const cpFailed = failed.find((f) => f.key === "candidateProfile");
      if (cpFailed) {
        const cpStats = {
          promptTokens: aggregateUsage.promptTokens,
          completionTokens: aggregateUsage.completionTokens,
          totalTokens: aggregateUsage.totalTokens,
          durationMs: Date.now() - runStartedAt,
          model: runModel,
          estimatedCostUSD: runModel
            ? estimateCostUSD(runModel, aggregateUsage.promptTokens, aggregateUsage.completionTokens)
            : null,
          runAt: new Date().toISOString(),
          modulesRun: results.length,
          modulesOk: results.filter((r) => r.status === "ok").length,
        };
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: `候选人档案模块失败: ${cpFailed.error}`,
            moduleStatus: JSON.stringify(moduleStatus),
            lastRunStats: JSON.stringify(cpStats),
          },
        });
        await safeWrite(
          `data: ${JSON.stringify(`[ERROR] candidateProfile failed: ${cpFailed.error}`)}\n\n`,
        );
        try { await writer.close(); } catch {}
        return;
      }

      // =================================================================
      // Post-process and persist (partial success allowed)
      // =================================================================
      postProcessScores(analysis as ResumeAnalysis);

      // Auto-detect tag if not already set
      const currentResume = await prisma.resume.findUnique({
        where: { id: params.id },
        select: { tag: true },
      });
      const tag = currentResume?.tag ?? autoDetectTag({
        pdfText: resume.pdfText,
        experienceYears: (analysis as Record<string, unknown> as { candidateProfile?: { experienceYears?: string } }).candidateProfile?.experienceYears,
        levelMatch: (analysis as Record<string, unknown> as { candidateProfile?: { levelMatch?: string } }).candidateProfile?.levelMatch,
      });

      // After merge, recompute aggregate failure list across all known modules,
      // so legacy modules that are still failed from a previous run remain visible.
      const aggregateFailed = Object.entries(moduleStatus)
        .filter(([, v]) => v.status === "error")
        .map(([key, v]) => ({ key, error: v.error || "未知错误" }));

      // -----------------------------------------------------------------
      // Build per-run stats: tokens / duration / estimated cost.
      // Stored as JSON on Resume.lastRunStats so the UI can display it.
      // -----------------------------------------------------------------
      const runStats = {
        promptTokens: aggregateUsage.promptTokens,
        completionTokens: aggregateUsage.completionTokens,
        totalTokens: aggregateUsage.totalTokens,
        durationMs: Date.now() - runStartedAt,
        model: runModel,
        estimatedCostUSD: runModel
          ? estimateCostUSD(runModel, aggregateUsage.promptTokens, aggregateUsage.completionTokens)
          : null,
        runAt: new Date().toISOString(),
        modulesRun: results.length,
        modulesOk: results.filter((r) => r.status === "ok").length,
      };

      await prisma.resume.update({
        where: { id: params.id },
        data: {
          analysisJson: JSON.stringify(analysis),
          moduleStatus: JSON.stringify(moduleStatus),
          lastRunStats: JSON.stringify(runStats),
          status: "completed",
          errorMessage: aggregateFailed.length === 0
            ? null
            : `失败模块: [${aggregateFailed.map((f) => f.key).join(", ")}] — ${aggregateFailed[0].error}`,
          tag,
        },
      });

      await safeWrite(`data: [DONE]\n\n`);
      try { await writer.close(); } catch {}
    } catch (error) {
      // Treat aborts as cancellations, not failures
      if (isAbortError(error) || abortCtl.signal.aborted) {
        console.warn(`[analyze:${params.id}] aborted by client`);
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: "已取消（客户端断开连接）",
          },
        });
        try { await writer.close(); } catch {}
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during analysis";

      console.error(`POST /api/analyze/${params.id} error:`, error);

      await prisma.resume.update({
        where: { id: params.id },
        data: {
          status: "failed",
          errorMessage: message,
        },
      });

      await safeWrite(`data: ${JSON.stringify(`[ERROR] ${message}`)}\n\n`);
      try { await writer.close(); } catch {}
    } finally {
      request.signal.removeEventListener("abort", onClientAbort);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
