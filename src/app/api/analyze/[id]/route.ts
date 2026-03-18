import { prisma } from "@/lib/db";
import { completion } from "@/lib/openai";
import { buildAnalysisPrompt, buildQuestionsPrompt } from "@/lib/prompt";
import { extractAndParseJSON } from "@/lib/json-utils";
import type { ResumeAnalysis } from "@/lib/types";
import { postProcessScores } from "@/lib/score-utils";

/**
 * POST /api/analyze/[id]
 *
 * Two-phase streaming analysis endpoint:
 *   Phase 1: Core analysis (profile, scoring, audit, projects, scoreCard)
 *   Phase 2: Question generation (technical + algorithm questions)
 *
 * Sends phase markers via SSE so the client can show progress:
 *   data: [PHASE:1]  — starting core analysis
 *   data: [PHASE:2]  — starting question generation
 *   data: [DONE]     — all phases complete
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
  // 3. Build prompts
  // -----------------------------------------------------------------------
  const analysisPrompt = buildAnalysisPrompt(
    resume.pdfText,
    resume.jdText ?? undefined,
    resume.filename
  );

  // -----------------------------------------------------------------------
  // 4. Stream both phases via TransformStream
  // -----------------------------------------------------------------------
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      // =================================================================
      // Phase 1: Core analysis
      // =================================================================
      await writer.write(encoder.encode(`data: [PHASE:1]\n\n`));

      const phase1Result = await completion(
        analysisPrompt.system,
        analysisPrompt.user
      );

      let analysis: Partial<ResumeAnalysis>;
      try {
        analysis = extractAndParseJSON(phase1Result) as Partial<ResumeAnalysis>;
      } catch (parseErr) {
        console.error(`Phase 1 JSON parse failed for resume ${params.id}:`, parseErr);
        console.error(`Raw output length: ${phase1Result.length}, last 200 chars: ${phase1Result.slice(-200)}`);
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage: "Phase 1: LLM response was not valid JSON.",
            analysisJson: phase1Result,
          },
        });
        await writer.write(
          encoder.encode(`data: ${JSON.stringify("[ERROR] Phase 1 failed to parse JSON")}\n\n`)
        );
        await writer.close();
        return;
      }

      // =================================================================
      // Phase 2: Question generation
      // =================================================================
      await writer.write(encoder.encode(`data: [PHASE:2]\n\n`));

      const questionsPrompt = buildQuestionsPrompt(
        resume.pdfText,
        JSON.stringify(analysis),
        resume.jdText ?? undefined,
        resume.filename
      );

      const phase2Result = await completion(
        questionsPrompt.system,
        questionsPrompt.user
      );

      try {
        const questions = extractAndParseJSON(phase2Result) as {
          technicalQuestions?: unknown[];
          algorithmQuestions?: unknown[];
        };
        // Merge questions into main analysis
        if (questions.technicalQuestions) {
          (analysis as Record<string, unknown>).technicalQuestions = questions.technicalQuestions;
        }
        if (questions.algorithmQuestions) {
          (analysis as Record<string, unknown>).algorithmQuestions = questions.algorithmQuestions;
        }
      } catch (parseErr) {
        console.error(`Phase 2 JSON parse failed for resume ${params.id}:`, parseErr);
        // Phase 2 failure is non-fatal — save what we have from phase 1
        // with empty questions arrays
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

      console.error(`POST /api/analyze/${params.id} streaming error:`, error);

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
