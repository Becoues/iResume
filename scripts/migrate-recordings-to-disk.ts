/**
 * One-off migration: move all Recording.data BLOBs to disk under
 * data/recordings/ (or RECORDINGS_DIR if set), populate Recording.path /
 * mimeType, and clear the BLOB column.
 *
 * Usage:
 *   npx tsx scripts/migrate-recordings-to-disk.ts
 *   # or via npm script:
 *   npm run migrate:recordings
 *
 * Idempotent: rows that already have a path are skipped. Safe to re-run.
 */

import { PrismaClient } from "@prisma/client";
import { saveRecording } from "../src/lib/recordings-storage";

async function main() {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.recording.findMany({
      where: { path: null, NOT: { data: null } },
      select: { id: true, data: true },
    });

    if (rows.length === 0) {
      console.log("✅ Nothing to migrate — all recordings already on disk.");
      return;
    }

    console.log(`Found ${rows.length} legacy BLOB recordings. Migrating...`);

    let ok = 0;
    let failed = 0;
    for (const row of rows) {
      if (!row.data) continue;
      try {
        const buffer = Buffer.from(row.data);
        const { relPath, mimeType } = await saveRecording(buffer, "audio/webm");
        await prisma.recording.update({
          where: { id: row.id },
          data: {
            path: relPath,
            mimeType,
            data: null,
          },
        });
        ok++;
        console.log(`  ✓ ${row.id} → ${relPath} (${buffer.length} bytes)`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${row.id} failed:`, err);
      }
    }

    console.log(`\nDone. migrated=${ok}, failed=${failed}`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
