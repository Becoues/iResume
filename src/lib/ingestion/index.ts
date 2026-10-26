import path from "node:path";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 120_000;
export const MAX_JD_CHARS = 16_000;
export class IngestionError extends Error {
  constructor(message: string, public status = 422) { super(message); this.name = "IngestionError"; }
}
export interface ResumeFile { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer>; }
export interface ExtractedResume { text: string; filename: string; sourceType: string; warnings: string[]; }

export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
}
export function validateText(value: string): string {
  const text = cleanText(value);
  if (!text || !/[\p{L}\p{N}]/u.test(text)) throw new IngestionError("未提取到有效文字，请上传清晰文件或直接粘贴简历正文。");
  if (text.length > MAX_TEXT_CHARS) throw new IngestionError(`简历超过 ${MAX_TEXT_CHARS} 字符上限，请精简后重试；本次没有截断或保存。`, 413);
  return text;
}
export function parseJd(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new IngestionError("职位描述必须是文字。", 400);
  if (value.length > MAX_JD_CHARS) throw new IngestionError(`职位描述超过 ${MAX_JD_CHARS} 字符，请精简后重试。`, 413);
  return cleanText(value) || null;
}
function filename(value: string): string {
  return path.basename(value.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "简历";
}
export function parsePaste(value: unknown): ExtractedResume & { jdText: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new IngestionError("请提交简历文字。", 400);
  const input = value as Record<string, unknown>;
  if (typeof input.text !== "string") throw new IngestionError("简历正文必须是文字。", 400);
  if (input.filename !== undefined && typeof input.filename !== "string") throw new IngestionError("文件名格式不正确。", 400);
  return { text: validateText(input.text), filename: filename((input.filename as string) || "粘贴的简历.txt"), sourceType: "text", warnings: [], jdText: parseJd(input.jd) };
}

export async function extractResume(file: ResumeFile): Promise<ExtractedResume> {
  if (file.size > MAX_FILE_BYTES) throw new IngestionError("文件超过 10MB，请压缩或分离出简历后重试。", 413);
  if (!file.size) throw new IngestionError("文件为空，请重新选择简历。", 400);
  const name = filename(file.name);
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!["pdf", "docx", "doc", "txt", "md", "rtf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
    throw new IngestionError("暂不支持该格式。请使用 PDF、Word、TXT、Markdown、RTF 或 PNG/JPEG/WebP 图片。", 415);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES) throw new IngestionError("文件超过 10MB。", 413);
  let text = "";
  const warnings: string[] = [];
  try {
    if (ext === "txt" || ext === "md") {
      text = decodeText(buffer);
    } else if (ext === "pdf") {
      if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new IngestionError("文件内容不是有效 PDF，请检查文件扩展名。", 415);
      const result = await (await import("./pdf")).extractPdf(buffer);
      text = result.text; warnings.push(...result.warnings);
    } else if (ext === "docx") {
      if (!buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) throw new IngestionError("文件内容不是有效 DOCX，请用 Word 重新另存为 DOCX。");
      await (await import("./zip")).validateDocxArchive(buffer);
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      if (result.messages.length) warnings.push("Word 中部分特殊元素可能无法提取，请核对提取正文。");
      warnings.push("Word 中的图片、页眉页脚和浮动文本框可能未包含在正文中，请核对关键经历与联系方式。");
    } else if (ext === "doc") {
      if (!buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) throw new IngestionError("文件不是有效的旧版 Word DOC。请另存为 DOCX 后重试。");
      const { default: WordExtractor } = await import("word-extractor");
      const doc = await new WordExtractor().extract(buffer);
      text = [doc.getBody(), doc.getHeaders(), doc.getFootnotes(), doc.getEndnotes(), doc.getTextboxes()].filter(Boolean).join("\n");
      warnings.push("已提取旧版 Word 正文；文档中的图片不参与文字提取，请核对正文。");
    } else if (ext === "rtf") {
      if (!buffer.subarray(0, 10).toString("ascii").startsWith("{\\rtf")) throw new IngestionError("文件内容不是有效 RTF。");
      validateRtf(buffer);
      const { default: rtf } = await import("rtf-parser");
      const doc = await new Promise<{ content: unknown[] }>((resolve, reject) => rtf.string(buffer.toString("latin1"), (error, parsed) => error ? reject(error) : resolve(parsed)));
      text = rtfText(doc);
    } else {
      validateImageSignature(buffer, ext);
      text = await (await import("./ocr")).recognizeImage(buffer);
      warnings.push("正文由本地 OCR 识别，姓名、数字与技术名词可能有误，请核对提取结果。");
    }
    return { text: validateText(text), filename: name, sourceType: ext, warnings };
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError(`无法读取这份 ${ext.toUpperCase()} 简历。文件可能损坏、加密或格式不匹配，请重新导出或粘贴正文。`);
  }
}
function decodeText(buffer: Buffer): string {
  try {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(buffer);
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(buffer);
    if (buffer.includes(0)) throw new Error("binary");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch { throw new IngestionError("文本编码无法识别或内容是二进制，请另存为 UTF-8 文本后重试。"); }
}
function rtfText(node: unknown, depth = 0): string {
  if (depth > 100) throw new IngestionError("RTF 嵌套过深，请另存为 TXT 或 DOCX。");
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const item = node as { content?: unknown; value?: unknown; type?: string };
  if (Array.isArray(item.content)) return item.content.map(child => rtfText(child, depth + 1)).join(item.type === "paragraph" ? "" : "\n");
  return typeof item.value === "string" ? item.value : typeof item.content === "string" ? item.content : "";
}
function validateImageSignature(buffer: Buffer, ext: string): void {
  const valid = ext === "png" ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : ext === "webp" ? buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"
    : buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!valid) throw new IngestionError("图片内容与扩展名不匹配，请重新导出 PNG、JPEG 或 WebP。");
}

/** Bound the request stream before multipart/JSON parsing allocates the entire body. */
export async function readBoundedRequest(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new IngestionError("上传内容过大，请将文件限制在 10MB 内。", 413);
  if (!request.body) throw new IngestionError("请求内容为空。", 400);
  const reader = request.body.getReader(); const chunks: Buffer[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new IngestionError("上传内容过大，请将文件限制在 10MB 内。", 413); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally { reader.releaseLock(); }
}

function validateRtf(buffer: Buffer): void {
  let depth = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 92) {
      // Binary payloads can contain arbitrary braces; require a text-oriented export.
      if (buffer.toString("ascii", i, i + 4) === "\\bin" && /[0-9 -]/.test(String.fromCharCode(buffer[i + 4] || 0))) {
        throw new IngestionError("RTF 含二进制对象，请另存为 DOCX 或纯文本后上传。");
      }
      if ([92, 123, 125].includes(buffer[i + 1])) i++;
      continue;
    }
    if (buffer[i] === 123) depth++;
    if (buffer[i] === 125) depth--;
    if (depth > 100) throw new IngestionError("RTF 嵌套过深，请另存为 DOCX 或纯文本。");
    if (depth < 0) throw new IngestionError("RTF 文件结构损坏，请重新导出。");
  }
  if (depth !== 0) throw new IngestionError("RTF 文件不完整，请重新导出。");
}
