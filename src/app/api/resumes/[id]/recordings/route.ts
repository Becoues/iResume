import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/resumes/[id]/recordings
 * List all recordings for a resume (without binary data), newest first.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const recordings = await prisma.recording.findMany({
      where: { resumeId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        duration: true,
        createdAt: true,
      },
    });
    return NextResponse.json(recordings);
  } catch (error) {
    console.error("GET recordings failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resumes/[id]/recordings
 * Upload a new recording. Expects multipart/form-data with:
 *   - audio (required): audio/webm blob
 *   - duration (required): recording duration in seconds
 *   - filename (optional): display name
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    // Verify resume exists
    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const durationStr = formData.get("duration");
    const duration =
      typeof durationStr === "string" ? parseInt(durationStr, 10) : 0;

    const filenameField = formData.get("filename");
    const filename =
      typeof filenameField === "string" && filenameField.trim()
        ? filenameField.trim()
        : `录音 ${new Date().toLocaleString("zh-CN")}`;

    const buffer = Buffer.from(await audio.arrayBuffer());

    const recording = await prisma.recording.create({
      data: {
        resumeId: id,
        filename,
        duration: isNaN(duration) ? 0 : duration,
        data: buffer,
      },
      select: {
        id: true,
        filename: true,
        duration: true,
        createdAt: true,
      },
    });

    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    console.error("POST recording failed:", error);
    return NextResponse.json(
      { error: "Failed to save recording" },
      { status: 500 }
    );
  }
}
