-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "uploadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfText" TEXT NOT NULL,
    "jdText" TEXT,
    "analysisJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Resume_uploadDate_idx" ON "Resume"("uploadDate");

-- CreateIndex
CREATE INDEX "Resume_status_idx" ON "Resume"("status");
