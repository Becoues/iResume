-- Additive migration: all legacy reports, settings, and recordings remain intact.
ALTER TABLE "Resume" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'pdf';
ALTER TABLE "Resume" ADD COLUMN "briefJson" TEXT;
ALTER TABLE "Resume" ADD COLUMN "briefStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "Resume" ADD COLUMN "briefError" TEXT;
ALTER TABLE "Resume" ADD COLUMN "briefRunId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "baseUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "region" TEXT NOT NULL DEFAULT 'us-west-2';
ALTER TABLE "Settings" ADD COLUMN "authMode" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Settings" ADD COLUMN "apiKeyEncrypted" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "bedrockKeyEncrypted" TEXT NOT NULL DEFAULT '';
CREATE TABLE "AnalysisRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "resumeId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'running',
  "mode" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL, "configJson" TEXT NOT NULL,
  "resultJson" TEXT, "error" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
  CONSTRAINT "AnalysisRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AnalysisRun_resumeId_createdAt_idx" ON "AnalysisRun"("resumeId", "createdAt");
CREATE INDEX "AnalysisRun_status_createdAt_idx" ON "AnalysisRun"("status", "createdAt");
