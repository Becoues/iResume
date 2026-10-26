-- Complete the legacy schema for installations created from the original migration.
-- Existing db-push installations must baseline this migration after schema verification.
ALTER TABLE "Resume" ADD COLUMN "moduleStatus" TEXT;
ALTER TABLE "Resume" ADD COLUMN "lastRunStats" TEXT;
ALTER TABLE "Resume" ADD COLUMN "tag" TEXT;
CREATE INDEX "Resume_tag_idx" ON "Resume"("tag");
CREATE TABLE "Settings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT NOT NULL DEFAULT 'CometAPI',
  "apiKeyCometapi" TEXT NOT NULL DEFAULT '',
  "model" TEXT NOT NULL DEFAULT 'gemini-3.1-pro-preview',
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Recording" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "resumeId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "path" TEXT,
  "mimeType" TEXT,
  "data" BLOB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Recording_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Recording_resumeId_createdAt_idx" ON "Recording"("resumeId", "createdAt");
