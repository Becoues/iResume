import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteRecordingFile, readRecordingStream } from "@/lib/recordings-storage";

/**
 * GET /api/resumes/[id]/recordings/[recordingId]
 *
 * Streams the recording audio. New rows are stored on disk (`path` column);
 * legacy rows still use the inline `data` BLOB until migrated by
 * `npm run migrate:recordings`. We never load the disk-backed file fully into
 * memory — it streams via Node's createReadStream → Web ReadableStream.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string; recordingId: string } }
) {
  const { recordingId } = params;
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { data: true, path: true, mimeType: true },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const mimeType = recording.mimeType || "audio/webm";

    // Preferred path: filesystem-backed
    if (recording.path) {
      try {
        const { size, stream } = readRecordingStream(recording.path);
        return new Response(stream, {
          headers: {
            "Content-Type": mimeType,
            "Content-Length": String(size),
            "Cache-Control": "private, max-age=3600",
          },
        });
      } catch (err) {
        console.error(`Recording ${recordingId} file missing on disk:`, err);
        // Fall through to BLOB fallback if path was set but file is gone
      }
    }

    // Legacy path: inline BLOB
    if (recording.data) {
      return new Response(new Uint8Array(recording.data), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(recording.data.length),
        },
      });
    }

    return NextResponse.json(
      { error: "Recording binary missing" },
      { status: 410 }
    );
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
 * Removes the row, then best-effort deletes the on-disk file (legacy BLOB
 * rows have no file, so deletion is a no-op for them).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; recordingId: string } }
) {
  const { recordingId } = params;
  try {
    const existing = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { path: true },
    });
    await prisma.recording.delete({ where: { id: recordingId } });
    if (existing?.path) {
      await deleteRecordingFile(existing.path);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE recording failed:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}
