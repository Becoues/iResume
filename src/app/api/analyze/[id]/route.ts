import { prisma } from "@/lib/db";
import { completion } from "@/lib/openai";
import { buildModulePrompt } from "@/lib/prompt";
import { ANALYSIS_MODULES } from "@/lib/modules";
import { extractAndParseJSON } from "@/lib/json-utils";
import type { ResumeAnalysis } from "@/lib/types";
import { postProcessScores } from "@/lib/score-utils";

/**
 * POST /api/analyze/[id]
 *
 * Runs selected analysis modules in parallel (max 3 concurrent to avoid
 * provider rate limits).
 *
 * Request body (optional):
 *   { modules?: number[] }   — IDs of modules to run (default: all)
 *
 * SSE markers:
 *   data: [STARTED]           — all calls kicked off
 *   data: [DONE:moduleKey]    — one module completed
 *   data: [DONE]              — all modules done, results persisted
 *
 * Status transitions:
 *   uploaded | failed | completed  ->  analyzing  ->  completed | failed
 */

const MAX_CONCURRENCY = 3;

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

      const results = await runWithConcurrency(
        tasks.map(({ module: mod, prompt }) => async () => {
          const raw = await completion(prompt.system, prompt.user);
          await writer.write(
            encoder.encode(`data: [DONE:${mod.key}]\n\n`)
          );
          return { key: mod.key, outputKeys: mod.outputKeys, raw };
        }),
        MAX_CONCURRENCY,
      );

      // =================================================================
      // Parse and merge results
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

      let fatalError = false;

      for (const result of results) {
        try {
          const parsed = extractAndParseJSON(result.raw) as Record<
            string,
            unknown
          >;
          for (const outKey of result.outputKeys) {
            if (parsed[outKey] !== undefined) {
              (analysis as Record<string, unknown>)[outKey] = parsed[outKey];
            }
          }
        } catch (parseErr) {
          console.error(
            `Module ${result.key} JSON parse failed for resume ${params.id}:`,
            parseErr
          );

          // Only candidateProfile (module 0) failure is fatal
          if (result.key === "candidateProfile") {
            fatalError = true;
            await prisma.resume.update({
              where: { id: params.id },
              data: {
                status: "failed",
                errorMessage: `候选人档案模块解析失败: LLM 返回的不是合法 JSON`,
                analysisJson: result.raw,
              },
            });
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify("[ERROR] candidateProfile parse failed")}\n\n`
              )
            );
          }
        }
      }

      if (fatalError) {
        await writer.close();
        return;
      }

      // =================================================================
      // Post-process and persist
      // =================================================================
      postProcessScores(analysis as ResumeAnalysis);

      await prisma.resume.update({
        where: { id: params.id },
        data: {
          analysisJson: JSON.stringify(analysis),
          status: "completed",
          errorMessage: null,
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
