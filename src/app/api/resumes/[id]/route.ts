import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/resumes/[id]
 *
 * Returns the full resume record. If analysisJson is stored as a
 * serialized string, it is parsed into an object before returning.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

    let parsedAnalysis: object | null = null;
    if (resume.analysisJson) {
      try {
        parsedAnalysis = JSON.parse(resume.analysisJson);
      } catch {
        // If the stored JSON is malformed, return it as-is under a raw key
        // so the client is aware something went wrong with the parse.
        parsedAnalysis = null;
      }
    }

    return NextResponse.json({
      ...resume,
      analysisJson: parsedAnalysis,
    });
  } catch (error) {
    console.error(`GET /api/resumes/${params.id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to fetch resume" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resumes/[id]
 *
 * Permanently deletes a resume record by id.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.resume.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    await prisma.resume.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, id: params.id });
  } catch (error) {
    console.error(`DELETE /api/resumes/${params.id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to delete resume" },
      { status: 500 }
    );
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
  { params }: { params: { id: string } }
) {
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
