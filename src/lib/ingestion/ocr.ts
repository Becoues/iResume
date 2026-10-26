import path from "node:path";
import { access } from "node:fs/promises";
import { createWorker, type Worker } from "tesseract.js";
import { loadImage } from "@napi-rs/canvas";
import { IngestionError } from "./index";

let busy = false;
export async function withOcr<T>(run: (recognize: (image: Buffer) => Promise<string>) => Promise<T>): Promise<T> {
  if (busy) throw new IngestionError("另一份简历正在进行文字识别，请稍后重试。", 429);
  busy = true;
  let worker: Worker | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const langPath = process.env.OCR_LANG_PATH || path.join(process.cwd(), "tessdata");
    try { await Promise.all(["eng", "chi_sim"].map(lang => access(path.join(langPath, `${lang}.traineddata`)))); }
    catch { throw new IngestionError("本地文字识别语言包尚未就绪，请联系管理员，或先粘贴简历文字。", 503); }
    const operation = (async () => {
      worker = await createWorker(["eng", "chi_sim"], 1, { langPath, gzip: false, cacheMethod: "none", errorHandler: () => {} });
      if (expired) { await worker.terminate(); throw new IngestionError("文字识别超时，请上传更小或更清晰的图片。", 422); }
      return run(async image => {
        const result = await worker!.recognize(image);
        return result.data.text;
      });
    })();
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new IngestionError("文字识别超过 120 秒，请减少页面或粘贴简历文字。", 422)); }, 120_000);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate().catch(() => {});
    busy = false;
  }
}

export async function recognizeImage(buffer: Buffer): Promise<string> {
  // Header inspection happens before a native decoder can allocate a huge image.
  const { imageSize } = await import("image-size");
  let dimensions;
  try { dimensions = imageSize(buffer); }
  catch { throw new IngestionError("图片损坏或无法识别，请重新导出图片。"); }
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 20_000_000 || dimensions.width > 10_000 || dimensions.height > 10_000) {
    throw new IngestionError("图片分辨率过大，请缩小到 2000 万像素以内后重试。", 413);
  }
  // Decode and re-encode locally to normalize supported formats (including WebP).
  const image = await loadImage(buffer);
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").drawImage(image, 0, 0);
  return withOcr(recognize => recognize(canvas.toBuffer("image/png")));
}
