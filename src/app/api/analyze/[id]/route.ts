import { prisma } from "@/lib/db";
import { completion } from "@/lib/openai";
import { buildAnalysisPrompt, buildTechnicalQuestionsPrompt, buildAlgorithmQuestionsPrompt } from "@/lib/prompt";
import { extractAndParseJSON } from "@/lib/json-utils";
import type { ResumeAnalysis } from "@/lib/types";
import { postProcessScores } from "@/lib/score-utils";

/**
 * POST /api/analyze/[id]
 *
 * Three parallel LLM calls:
 *   1. Core analysis (profile, scoring, audit, projects, scoreCard)
 *   2. Technical question generation (15 questions)
 *   3. Algorithm question generation (9 questions)
 *
 * Sends completion markers via SSE so the client can show progress:
 *   data: [STARTED]      — all three calls kicked off
 *   data: [DONE:1]       — core analysis complete
 *   data: [DONE:2]       — technical questions complete
 *   data: [DONE:3]       — algorithm questions complete
 *   data: [DONE]         — all phases complete, results persisted
 *
 * Status transitions:
 *   uploaded | failed  ->  analyzing  ->  completed | failed
 */
export async function POST(
  _request: Request,
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
  // 2. Mark as analyzing
  // -----------------------------------------------------------------------
  await prisma.resume.update({
    where: { id: params.id },
    data: { status: "analyzing", errorMessage: null },
  });

  // -----------------------------------------------------------------------
  // 3. Build all three prompts (no dependencies between them)
  // -----------------------------------------------------------------------
  const pdfText = resume.pdfText;
  const jdText = resume.jdText ?? undefined;
  const filename = resume.filename;

  const analysisPrompt = buildAnalysisPrompt(pdfText, jdText, filename);
  const techQPrompt = buildTechnicalQuestionsPrompt(pdfText, jdText, filename);
  const algoQPrompt = buildAlgorithmQuestionsPrompt(pdfText, jdText, filename);

  // -----------------------------------------------------------------------
  // 4. Run all three in parallel, report progress via SSE
  // -----------------------------------------------------------------------
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      await writer.write(encoder.encode(`data: [STARTED]\n\n`));

      // Launch all three LLM calls concurrently
      const [phase1Result, phase2Result, phase3Result] = await Promise.all([
        completion(analysisPrompt.system, analysisPrompt.user).then(async (r) => {
          await writer.write(encoder.encode(`data: [DONE:1]\n\n`));
          return r;
        }),
        completion(techQPrompt.system, techQPrompt.user).then(async (r) => {
          await writer.write(encoder.encode(`data: [DONE:2]\n\n`));
          return r;
        }),
        completion(algoQPrompt.system, algoQPrompt.user).then(async (r) => {
          await writer.write(encoder.encode(`data: [DONE:3]\n\n`));
          return r;
        }),
      ]);

      // =================================================================
      // Parse and merge results
      // =================================================================
      let analysis: Partial<ResumeAnalysis>;
      try {
        analysis = extractAndParseJSON(phase1Result) as Partial<ResumeAnalysis>;
      } catch (parseErr) {
        console.error(`Core analysis JSON parse failed for resume ${params.id}:`, parseErr);
        console.error(`Raw output length: ${phase1Result.length}, last 200 chars: ${phase1Result.slice(-200)}`);
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: "核心分析: LLM 返回的不是合法 JSON",
            analysisJson: phase1Result,
          },
        });
        await writer.write(
          encoder.encode(`data: ${JSON.stringify("[ERROR] Core analysis failed to parse JSON")}\n\n`)
        );
        await writer.close();
        return;
      }

      // Merge technical questions (non-fatal if parse fails)
      try {
        const techQ = extractAndParseJSON(phase2Result) as {
          technicalQuestions?: unknown[];
        };
        if (techQ.technicalQuestions) {
          (analysis as Record<string, unknown>).technicalQuestions = techQ.technicalQuestions;
        }
      } catch (parseErr) {
        console.error(`Technical questions JSON parse failed for resume ${params.id}:`, parseErr);
      }

      // Merge algorithm questions (non-fatal if parse fails)
      try {
        const algoQ = extractAndParseJSON(phase3Result) as {
          algorithmQuestions?: unknown[];
        };
        if (algoQ.algorithmQuestions) {
          (analysis as Record<string, unknown>).algorithmQuestions = algoQ.algorithmQuestions;
        }
      } catch (parseErr) {
        console.error(`Algorithm questions JSON parse failed for resume ${params.id}:`, parseErr);
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
        error instanceof Error ? error.message : "Unknown error during analysis";

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
          encoder.encode(`data: ${JSON.stringify(`[ERROR] ${message}`)}\n\n`)
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
