import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/pdf";

/**
 * GET /api/resumes
 *
 * Lists all resumes ordered by uploadDate descending.
 * Returns a summary view — full pdfText and analysisJson are excluded.
 * If analysisJson exists, the finalScore is extracted and returned
 * inside a scoreCard object.
 */
export async function GET() {
  try {
    const resumes = await prisma.resume.findMany({
      orderBy: { uploadDate: "desc" },
      select: {
        id: true,
        filename: true,
        uploadDate: true,
        status: true,
        analysisJson: true,
        updatedAt: true,
        tag: true,
      },
    });

    const summaries = resumes.map((resume) => {
      let scoreCard: {
        finalScore: number | null;
        architectureTotal: number | null;
        dnaTotal: number | null;
      } | null = null;
      let candidateName: string | null = null;
      let techDirection: string | null = null;
      let experienceYears: string | null = null;
      let levelMatch: string | null = null;
      let recommendation: string | null = null;

      if (resume.analysisJson) {
        try {
          const analysis = JSON.parse(resume.analysisJson);
          scoreCard = {
            finalScore: analysis.scoreCard?.finalScore ?? analysis.finalScore ?? null,
            architectureTotal: analysis.scoreCard?.architectureTotal ?? null,
            dnaTotal: analysis.scoreCard?.dnaTotal ?? null,
          };
          candidateName = analysis.candidateProfile?.name ?? null;
          techDirection = analysis.candidateProfile?.techDirection ?? null;
          experienceYears = analysis.candidateProfile?.experienceYears ?? null;
          levelMatch = analysis.candidateProfile?.levelMatch ?? null;
          recommendation = analysis.scoreCard?.recommendation ?? null;
        } catch {
          scoreCard = { finalScore: null, architectureTotal: null, dnaTotal: null };
        }
      }

      return {
        id: resume.id,
        filename: resume.filename,
        uploadDate: resume.uploadDate,
        status: resume.status,
        updatedAt: resume.updatedAt,
        scoreCard,
        candidateName,
        techDirection,
        experienceYears,
        levelMatch,
        recommendation,
        tag: resume.tag,
      };
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("GET /api/resumes failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch resumes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resumes
 *
 * Accepts multipart/form-data with:
 *   - file (required): A PDF file
 *   - jd   (optional): Job description text
 *
 * Extracts text from the uploaded PDF, persists the record with
 * status "uploaded", and returns the newly created resume.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required in the 'file' field" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    const jd = formData.get("jd");
    const jdText = typeof jd === "string" && jd.trim() ? jd.trim() : null;

    const buffer = Buffer.from(await file.arrayBuffer());

    let pdfText: string;
    try {
      pdfText = await extractTextFromPdf(buffer);
    } catch (pdfError) {
      console.error("PDF parse error:", pdfError);
      return NextResponse.json(
        { error: "无法解析该 PDF 文件，请确保文件未损坏且包含可提取的文本" },
        { status: 422 }
      );
    }

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract any text from the uploaded PDF" },
        { status: 422 }
      );
    }

    const resume = await prisma.resume.create({
      data: {
        filename: file.name,
        pdfText,
        jdText,
        status: "uploaded",
      },
    });

    return NextResponse.json(resume, { status: 201 });
  } catch (error) {
    console.error("POST /api/resumes failed:", error);
    return NextResponse.json(
      { error: "Failed to upload resume" },
      { status: 500 }
    );
  }
}
