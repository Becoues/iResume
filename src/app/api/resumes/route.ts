import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBriefState } from "@/lib/brief-runtime";
import { extractResume, IngestionError, MAX_FILE_BYTES, parseJd, parsePaste, readBoundedRequest } from "@/lib/ingestion";
import type { CandidateBrief } from "@/lib/prep-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const number = (key: string, fallback: number, max: number) => {
      const value = Number(query.get(key) ?? fallback);
      return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
    };
    const limit = Math.max(1, number("limit", 50, 100));
    const offset = number("offset", 0, 100_000);
    const resumes = await prisma.resume.findMany({
      orderBy: [{ uploadDate: "desc" }, { id: "desc" }], take: limit, skip: offset,
      select: { id: true, filename: true, uploadDate: true, updatedAt: true, status: true, tag: true, sourceType: true, briefJson: true, briefStatus: true },
    });
    // Let SQLite project only the small historical fields; never load every old report.
    const legacy = resumes.length ? await prisma.$queryRaw<Array<{ id: string; candidateName: string | null; techDirection: string | null; experienceYears: string | null; levelMatch: string | null; recommendation: string | null; finalScore: number | null; architectureTotal: number | null; dnaTotal: number | null }>>(Prisma.sql`
      SELECT id,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.candidateProfile.name') END AS candidateName,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.candidateProfile.techDirection') END AS techDirection,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.candidateProfile.experienceYears') END AS experienceYears,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.candidateProfile.levelMatch') END AS levelMatch,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.scoreCard.recommendation') END AS recommendation,
        CASE WHEN json_valid(analysisJson) THEN COALESCE(json_extract(analysisJson, '$.scoreCard.finalScore'), json_extract(analysisJson, '$.finalScore')) END AS finalScore,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.scoreCard.architectureTotal') END AS architectureTotal,
        CASE WHEN json_valid(analysisJson) THEN json_extract(analysisJson, '$.scoreCard.dnaTotal') END AS dnaTotal
      FROM Resume WHERE id IN (${Prisma.join(resumes.map(row => row.id))})
    `) : [];
    const oldById = new Map(legacy.map(row => [row.id, row]));
    const summaries = await Promise.all(resumes.map(async row => {
      let brief: CandidateBrief | null = null;
      try { brief = row.briefJson ? JSON.parse(row.briefJson) : null; } catch { /* Preserve corrupt legacy storage without treating it as a brief. */ }
      const state = row.briefStatus === "running" ? await getBriefState(row.id) : null;
      if (state) brief = state.brief;
      const old = oldById.get(row.id);
      return {
        id: row.id, filename: row.filename, uploadDate: row.uploadDate, updatedAt: row.updatedAt,
        status: row.status, tag: row.tag, sourceType: row.sourceType, briefStatus: state?.briefStatus || row.briefStatus,
        candidateName: brief?.candidate?.name || old?.candidateName || null,
        techDirection: brief?.candidate?.headline || old?.techDirection || null,
        summary: brief?.summary || null,
        experienceYears: brief?.candidate?.experience || old?.experienceYears || null,
        levelMatch: old?.levelMatch || null, recommendation: old?.recommendation || null,
        scoreCard: old?.finalScore != null ? { finalScore: old.finalScore, architectureTotal: old.architectureTotal, dnaTotal: old.dnaTotal } : null,
      };
    }));
    return NextResponse.json(summaries, { headers: { "X-Page-Limit": String(limit), "X-Page-Offset": String(offset), "X-Has-More": String(resumes.length === limit) } });
  } catch {
    return NextResponse.json({ error: "无法读取简历列表，请稍后重试。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let extracted;
    let jdText: string | null;
    if (contentType.includes("application/json")) {
      const body = await readBoundedRequest(request, 1024 * 1024);
      let input;
      try { input = JSON.parse(body.toString("utf8")); } catch { throw new IngestionError("提交的文字格式不正确，请重试。", 400); }
      const pasted = parsePaste(input); extracted = pasted; jdText = pasted.jdText;
    } else if (contentType.includes("multipart/form-data")) {
      const body = await readBoundedRequest(request, MAX_FILE_BYTES + 256 * 1024);
      let form: FormData;
      try { form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: new Uint8Array(body) }).formData(); }
      catch { throw new IngestionError("上传表单不完整，请重新选择文件。", 400); }
      const file = form.get("file");
      if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new IngestionError("请选择一份简历文件。", 400);
      jdText = parseJd(form.get("jd"));
      extracted = await extractResume(file);
    } else throw new IngestionError("请使用文件上传或粘贴简历文字。", 415);
    const resume = await prisma.resume.create({ data: { filename: extracted.filename, pdfText: extracted.text, jdText, sourceType: extracted.sourceType, status: "uploaded" } });
    return NextResponse.json({ ...resume, brief: null, briefRun: null, warnings: extracted.warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof IngestionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "简历保存失败，请稍后重试。" }, { status: 500 });
  }
}
