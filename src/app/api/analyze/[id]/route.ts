import { prisma } from "@/lib/db";
import { completion } from "@/lib/openai";
import { buildModulePrompt } from "@/lib/prompt";
import { ANALYSIS_MODULES } from "@/lib/modules";
import { extractAndParseJSON } from "@/lib/json-utils";
import type { ResumeAnalysis } from "@/lib/types";
import { postProcessScores } from "@/lib/score-utils";
import { autoDetectTag } from "@/lib/auto-tag";

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

/** Run async tasks with a concurrency limit */
async function runWithConcurrency<T>(
  fns: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(fns.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < fns.length) {
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

  (async () => {
    try {
      await writer.write(encoder.encode(`data: [STARTED]\n\n`));

      type ModuleResult =
        | { key: string; outputKeys: string[]; status: "ok"; parsed: Record<string, unknown> }
        | { key: string; outputKeys: string[]; status: "error"; error: string };

      const results = await runWithConcurrency<ModuleResult>(
        tasks.map(({ module: mod, prompt }) => async () => {
          try {
            const raw = await completion(prompt.system, prompt.user);
            const parsed = extractAndParseJSON(raw) as Record<string, unknown>;
            await writer.write(encoder.encode(`data: [DONE:${mod.key}]\n\n`));
            return { key: mod.key, outputKeys: mod.outputKeys, status: "ok", parsed };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Module ${mod.key} failed for resume ${params.id}:`, err);
            await writer.write(encoder.encode(`data: [FAIL:${mod.key}]\n\n`));
            return { key: mod.key, outputKeys: mod.outputKeys, status: "error", error: msg };
          }
        }),
        MAX_CONCURRENCY,
      );

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

      const failed: { key: string; error: string }[] = [];

      for (const r of results) {
        if (r.status === "ok") {
          for (const outKey of r.outputKeys) {
            if (r.parsed[outKey] !== undefined) {
              (analysis as Record<string, unknown>)[outKey] = r.parsed[outKey];
            }
          }
        } else {
          failed.push({ key: r.key, error: r.error });
        }
      }

      // Only candidateProfile failure is fatal — without it the whole analysis is meaningless
      const cpFailed = failed.find((f) => f.key === "candidateProfile");
      if (cpFailed) {
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: `候选人档案模块失败: ${cpFailed.error}`,
          },
        });
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify(`[ERROR] candidateProfile failed: ${cpFailed.error}`)}\n\n`
          )
        );
        await writer.close();
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

      await prisma.resume.update({
        where: { id: params.id },
        data: {
          analysisJson: JSON.stringify(analysis),
          status: "completed",
          errorMessage: failed.length === 0
            ? null
            : `失败模块: [${failed.map((f) => f.key).join(", ")}] — ${failed[0].error}`,
          tag,
        },
      });

      await writer.write(encoder.encode(`data: [DONE]\n\n`));
      await writer.close();
    } catch (error) {
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

      try {
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify(`[ERROR] ${message}`)}\n\n`
          )
        );
        await writer.close();
      } catch {
        await writer.abort();
      }
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
