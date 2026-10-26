import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBriefState, recoverStaleRuns } from "@/lib/brief-runtime";
import { deleteRecordingFile } from "@/lib/recordings-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const resume = await prisma.resume.findUnique({ where: { id: params.id } });
    if (!resume) return NextResponse.json({ error: "简历不存在。" }, { status: 404 });
    const state = await getBriefState(params.id);
    let analysis: unknown = resume.analysisJson;
    if (resume.analysisJson) { try { analysis = JSON.parse(resume.analysisJson); } catch { /* Keep original legacy data available. */ } }
    const { briefJson: _briefJson, briefRunId: _briefRunId, ...publicResume } = resume;
    return NextResponse.json({ ...publicResume, analysisJson: analysis, ...state });
  } catch {
    return NextResponse.json({ error: "无法读取简历，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    await recoverStaleRuns(params.id);
    const result = await prisma.$transaction(async tx => {
      // Acquire SQLite's writer lock before observing job state so start/delete cannot race.
      const lock = await tx.resume.updateMany({ where: { id: params.id }, data: { id: params.id } });
      if (!lock.count) return { status: 404, paths: [] as string[] };
      const resume = await tx.resume.findUniqueOrThrow({ where: { id: params.id }, select: { briefStatus: true } });
      const active = await tx.analysisRun.count({ where: { resumeId: params.id, status: "running" } });
      if (resume.briefStatus === "running" || active) return { status: 409, paths: [] as string[] };
      const recordings = await tx.recording.findMany({ where: { resumeId: params.id }, select: { path: true } });
      await tx.resume.delete({ where: { id: params.id } });
      return { status: 200, paths: recordings.flatMap(row => row.path ? [row.path] : []) };
    }, { timeout: 10_000, maxWait: 10_000 });
    if (result.status === 404) return NextResponse.json({ error: "简历不存在。" }, { status: 404 });
    if (result.status === 409) return NextResponse.json({ error: "简报正在生成，请完成后再删除。" }, { status: 409 });
    await Promise.all(result.paths.map(deleteRecordingFile));
    return NextResponse.json({ success: true, id: params.id });
  } catch {
    return NextResponse.json({ error: "删除失败，请稍后重试。" }, { status: 500 });
  }
}

/**
 * PATCH /api/resumes/[id]
 *
 * Accepts a JSON body with partial analysis updates. Loads the
 * existing analysisJson, deep-merges the incoming patch on top,
 * and saves the result back. This enables inline editing of
 * individual analysis fields without replacing the entire object.
 */
export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: params.id },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    const patch = await request.json();

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    // Handle tag update
    const VALID_TAGS = ["校招", "实习", "社招"];
    if ("tag" in patch) {
      if (patch.tag !== null && !VALID_TAGS.includes(patch.tag)) {
        return NextResponse.json(
          { error: `Invalid tag. Must be one of: ${VALID_TAGS.join(", ")}` },
          { status: 400 }
        );
      }
      const updated = await prisma.resume.update({
        where: { id: params.id },
        data: { tag: patch.tag },
      });
      // If only tag update, return early
      if (Object.keys(patch).length === 1) {
        let parsedAnalysis: object | null = null;
        if (updated.analysisJson) {
          try { parsedAnalysis = JSON.parse(updated.analysisJson); } catch {}
        }
        return NextResponse.json({ ...updated, analysisJson: parsedAnalysis });
      }
    }

    // Parse the existing analysis (default to empty object)
    let existing: Record<string, unknown> = {};
    if (resume.analysisJson) {
      try {
        existing = JSON.parse(resume.analysisJson);
      } catch {
        existing = {};
      }
    }

    // Remove 'tag' from patch before deep-merging into analysis
    const { tag: _tag, ...analysisPatch } = patch;
    const merged = deepMerge(existing, analysisPatch);

    const updateData: Record<string, unknown> = {
      analysisJson: JSON.stringify(merged),
    };
    if ("tag" in patch) {
      updateData.tag = patch.tag;
    }

    const updated = await prisma.resume.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      analysisJson: merged,
    });
  } catch (error) {
    console.error(`PATCH /api/resumes/${params.id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to update resume analysis" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively deep-merges `source` into `target`. Arrays in `source`
 * replace arrays in `target` rather than being concatenated, which is
 * the expected behaviour for a PATCH-style update.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) continue;
    const srcVal = source[key];
    const tgtVal = target[key];

    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      );
    } else {
      result[key] = srcVal;
    }
  }

  return result;
}
