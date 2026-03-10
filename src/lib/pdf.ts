import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";

// Resolve pdfjs-dist data directory — works in both dev and standalone Docker mode
function getPdfjsDir(): string {
  // Try require.resolve first (works in dev / normal node_modules)
  try {
    return path.dirname(require.resolve("pdfjs-dist/package.json"));
  } catch {
    // Fallback for standalone mode: node_modules/pdfjs-dist relative to cwd
    return path.join(process.cwd(), "node_modules", "pdfjs-dist");
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const pdfjsDir = getPdfjsDir();
  const pdf = await getDocument({
    data: uint8Array,
    cMapUrl: path.join(pdfjsDir, "cmaps") + "/",
    cMapPacked: true,
    standardFontDataUrl: path.join(pdfjsDir, "standard_fonts") + "/",
    useSystemFonts: true,
  }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n");
}
