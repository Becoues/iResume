import path from "node:path";
import { createCanvas, DOMMatrix, ImageData, Path2D, type Canvas } from "@napi-rs/canvas";
import { IngestionError, MAX_TEXT_CHARS } from "./index";
import { withOcr } from "./ocr";

const MAX_PAGES = 30;
const MAX_OCR_PAGES = 10;
class CanvasFactory {
  create(width: number, height: number) {
    if (width * height > 20_000_000) throw new IngestionError("PDF 页面尺寸过大，请缩小页面后重试。", 413);
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(target: { canvas: Canvas }, width: number, height: number) { target.canvas.width = Math.ceil(width); target.canvas.height = Math.ceil(height); }
  destroy(target: { canvas: Canvas }) { target.canvas.width = 1; target.canvas.height = 1; }
}
export async function extractPdf(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  // pdfjs uses these DOM primitives even when it renders on a Node canvas.
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.DOMMatrix ??= DOMMatrix; globals.ImageData ??= ImageData; globals.Path2D ??= Path2D;
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dir = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const canvasFactory = new CanvasFactory();
  const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true,
    cMapUrl: path.join(dir, "cmaps") + "/", cMapPacked: true, standardFontDataUrl: path.join(dir, "standard_fonts") + "/",
    CanvasFactory, wasmUrl: path.join(dir, "wasm") + "/", verbosity: 0,
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > MAX_PAGES) throw new IngestionError(`PDF 共 ${pdf.numPages} 页，超过 ${MAX_PAGES} 页上限，请只保留简历页面。`, 413);
    const texts: string[] = [];
    const scanned: number[] = [];
    let chars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      chars += text.length;
      if (chars > MAX_TEXT_CHARS) throw new IngestionError("PDF 文字过长，请只保留简历正文后重试。", 413);
      texts.push(text);
      // A sparse text layer may contain only a page number over a scanned image.
      if (text.replace(/\s/g, "").length < 20) {
        const operators = await page.getOperatorList();
        const imageOps = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject];
        if (operators.fnArray.some(operation => imageOps.includes(operation))) scanned.push(i);
      }
      page.cleanup();
    }
    if (scanned.length > MAX_OCR_PAGES) throw new IngestionError(`PDF 中有 ${scanned.length} 页需要文字识别，超过 ${MAX_OCR_PAGES} 页上限，请减少页面。`, 413);
    const warnings: string[] = [];
    if (scanned.length) {
      await withOcr(async recognize => {
        for (const number of scanned) {
          const page = await pdf.getPage(number);
          const viewport = page.getViewport({ scale: 2 });
          const target = canvasFactory.create(viewport.width, viewport.height);
          try {
            await page.render({ canvas: target.canvas as unknown as HTMLCanvasElement, canvasContext: target.context as unknown as CanvasRenderingContext2D, viewport }).promise;
            const ocr = (await recognize(target.canvas.toBuffer("image/png"))).trim();
            if (ocr.length >= texts[number - 1].length) texts[number - 1] = ocr;
          } finally { canvasFactory.destroy(target); page.cleanup(); }
        }
      });
      warnings.push(`第 ${scanned.join("、")} 页使用本地 OCR 识别，姓名、数字和技术名词可能有误，请核对正文。`);
      const empty = scanned.filter(number => !texts[number - 1].trim());
      if (empty.length) warnings.push(`第 ${empty.join("、")} 页未识别到文字，可能为空白页或图片不清晰。`);
    }
    return { text: texts.join("\n\n"), warnings };
  } finally { await pdf.destroy(); }
}
