import { promises as fs, existsSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

/**
 * Recording binaries are stored on disk under RECORDINGS_DIR (defaults to
 * `<cwd>/data/recordings`). Each row in the Recording table holds a relative
 * path; the GET endpoint streams the file directly so we never load the whole
 * blob into memory like the legacy `Recording.data` BLOB column did.
 *
 * Paths stored in the DB are relative to the base dir (no leading slash) and
 * always validated to live under it before we touch the filesystem.
 */

function baseDir(): string {
  return process.env.RECORDINGS_DIR || path.join(process.cwd(), "data", "recordings");
}

async function ensureBaseDir(): Promise<string> {
  const dir = baseDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function resolveSafe(relPath: string): string {
  const dir = baseDir();
  const abs = path.resolve(dir, relPath);
  // Block any path that escapes the base dir
  if (!abs.startsWith(path.resolve(dir) + path.sep) && abs !== path.resolve(dir)) {
    throw new Error(`Refusing to access path outside recordings dir: ${relPath}`);
  }
  return abs;
}

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return ".webm";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return ".m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("wav")) return ".wav";
  return ".webm";
}

export async function saveRecording(
  buffer: Buffer,
  mimeType: string | null,
): Promise<{ relPath: string; absPath: string; mimeType: string }> {
  const dir = await ensureBaseDir();
  const ext = extFromMime(mimeType);
  const filename = `${Date.now()}-${randomUUID()}${ext}`;
  const absPath = path.join(dir, filename);
  await fs.writeFile(absPath, buffer);
  return { relPath: filename, absPath, mimeType: mimeType || "audio/webm" };
}

export interface RecordingFileInfo {
  size: number;
  stream: ReadableStream<Uint8Array>;
}

export function readRecordingStream(relPath: string): RecordingFileInfo {
  const abs = resolveSafe(relPath);
  if (!existsSync(abs)) throw new Error("Recording file not found on disk");
  const stat = statSync(abs);
  // Convert Node stream → Web ReadableStream so the Next.js Response can pipe it.
  const nodeStream = createReadStream(abs);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return { size: stat.size, stream: webStream };
}

export async function deleteRecordingFile(relPath: string): Promise<void> {
  try {
    const abs = resolveSafe(relPath);
    await fs.unlink(abs);
  } catch {
    // best-effort: file may have been removed manually
  }
}
