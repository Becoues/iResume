import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await getDocument({ data: uint8Array }).promise;

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
