import { prisma } from "@/lib/db";
import { getOpenAIClient, getModel } from "@/lib/openai";
import { buildAnalysisPrompt } from "@/lib/prompt";
import type { ResumeAnalysis } from "@/lib/types";

/**
 * POST /api/analyze/[id]
 *
 * Streaming analysis endpoint. Sends the resume text (and optional JD)
 * to the LLM via OpenAI-compatible streaming, piping chunks to the
 * client in real time as text/event-stream. When the stream completes
 * the full response is parsed as JSON and persisted to the database.
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
  // 3. Build the prompt
  // -----------------------------------------------------------------------
  const prompt = buildAnalysisPrompt(resume.pdfText, resume.jdText ?? undefined);

  // -----------------------------------------------------------------------
  // 4 & 5. Stream the LLM response to the client via TransformStream
  // -----------------------------------------------------------------------
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Fire-and-forget: run the streaming completion in the background so the
  // Response can be returned immediately.
  (async () => {
    let accumulated = "";

    try {
      const [openai, model] = await Promise.all([getOpenAIClient(), getModel()]);

      const stream = await openai.chat.completions.create({
        model,
        stream: true,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          accumulated += content;
          // Write each chunk as an SSE data frame
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(content)}\n\n`)
          );
        }
      }

      // ---------------------------------------------------------------
      // 6 & 7. Parse the accumulated response and persist
      // ---------------------------------------------------------------
      let analysis: ResumeAnalysis;
      try {
        // The model may wrap its JSON in a markdown code fence. Strip it
        // before parsing so we get clean JSON.
        const cleaned = accumulated
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();

        analysis = JSON.parse(cleaned) as ResumeAnalysis;
      } catch {
        // If the LLM output is not valid JSON, store the raw text and
        // mark as failed so the user can inspect what went wrong.
        await prisma.resume.update({
          where: { id: params.id },
          data: {
            status: "failed",
            errorMessage:
              "LLM response was not valid JSON. Raw output saved in analysisJson.",
            analysisJson: accumulated,
          },
        });

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify("[ERROR] Failed to parse analysis JSON")}\n\n`
          )
        );
        await writer.close();
        return;
      }

      await prisma.resume.update({
        where: { id: params.id },
        data: {
          analysisJson: JSON.stringify(analysis),
          status: "completed",
          errorMessage: null,
        },
      });

      // Signal completion to the client
      await writer.write(encoder.encode(`data: [DONE]\n\n`));
      await writer.close();
    } catch (error) {
      // -----------------------------------------------------------------
      // 8. On error, mark as failed
      // -----------------------------------------------------------------
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
          encoder.encode(
            `data: ${JSON.stringify(`[ERROR] ${message}`)}\n\n`
          )
        );
        await writer.close();
      } catch {
        // Writer may already be closed if the client disconnected.
        await writer.abort();
      }
    }
  })();

  // Return the readable side of the TransformStream as the response body
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
