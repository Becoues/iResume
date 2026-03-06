import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/resumes/[id]/recordings/[recordingId]
 * Stream the audio binary data for playback.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string; recordingId: string } }
) {
  const { recordingId } = params;
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { data: true },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    return new Response(new Uint8Array(recording.data), {
      headers: {
        "Content-Type": "audio/webm",
        "Content-Length": String(recording.data.length),
      },
    });
  } catch (error) {
    console.error("GET recording audio failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch recording" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resumes/[id]/recordings/[recordingId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; recordingId: string } }
) {
  const { recordingId } = params;
  try {
    await prisma.recording.delete({ where: { id: recordingId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE recording failed:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}
