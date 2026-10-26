import test from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { extractResume, parsePaste, IngestionError } from "../src/lib/ingestion";

function file(name: string, content: string | Buffer, type = "") {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return { name, type, size: data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
}

test("rejects oversized upload before materializing its bytes", async () => {
  let read = false;
  await assert.rejects(extractResume({ name: "cv.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf", arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } }), (e: unknown) => e instanceof IngestionError && e.status === 413);
  assert.equal(read, false);
});
test("extracts Chinese text and markdown without interpreting markup", async () => {
  const result = await extractResume(file("张三.MD", "# 张三\n数据工程师 <script>alert(1)</script>"));
  assert.equal(result.sourceType, "md");
  assert.equal(result.text, "# 张三\n数据工程师 <script>alert(1)</script>");
});
test("rejects empty files, unsupported types, disguised binary and malformed PDF", async () => {
  for (const input of [file("cv.txt", " "), file("cv.exe", "abc"), file("cv.txt", Buffer.from([0, 1, 2, 0])), file("cv.pdf", "not a PDF")]) {
    await assert.rejects(extractResume(input), IngestionError);
  }
});
test("paste validation retains full text and rejects excess rather than truncating", () => {
  assert.equal(parsePaste({ text: "  张三\n后端工程师  ", jd: " Java " }).text, "张三\n后端工程师");
  assert.equal(parsePaste({ text: "cv", jd: " Java " }).jdText, "Java");
  for (const input of [{ text: " " }, { text: 3 }, { text: "cv", jd: {} }, { text: "x".repeat(120001) }, { text: "cv", jd: "x".repeat(16001) }]) assert.throws(() => parsePaste(input), IngestionError);
});
test("extracts a real PDF text layer", async () => {
  const doc = new jsPDF(); doc.text("Alice - Data Engineer", 10, 20);
  const result = await extractResume(file("cv.pdf", Buffer.from(doc.output("arraybuffer"))));
  assert.match(result.text, /Alice - Data Engineer/);
  assert.equal(result.sourceType, "pdf");
});
test("rejects excessive PDF pages without silently taking the first pages", async () => {
  const doc = new jsPDF();
  for (let i = 0; i < 30; i++) doc.addPage();
  await assert.rejects(extractResume(file("cv.pdf", Buffer.from(doc.output("arraybuffer")))), (e: unknown) => e instanceof IngestionError && e.status === 413 && /页/.test(e.message));
});
test("extracts RTF text without font tables or markup", async () => {
  const result = await extractResume(file("cv.rtf", "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Alice\\par Data Engineer}"));
  assert.match(result.text, /Alice/); assert.match(result.text, /Data Engineer/); assert.doesNotMatch(result.text, /fonttbl|Arial/);
});

test("extracts real DOCX paragraphs including Chinese", async () => {
  const result = await extractResume(file("cv.docx", Buffer.from("UEsDBBQAAAAIACkbWl1Rl+gEsQAAABQBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QvQ7CMAyEX6XKilpXDAyo7QKswMALWInbRjQ/StxS3p4UUAcGRvu7O59c3Z6eYjabwcZa9Mx+DxBlTwZj4TzZRFoXDHIaQwce5R07gm1Z7kA6y2Q55yVDNNWRWhwHzk5zWkftbC2SXWSHj245VQv0ftASOWFYKDTVZaIQtKLsioHPaJIKHi4oUE6OJjmL/zGTVT9dc9e2WtLqX9J8cJJi1LYzQ7ESg9puvj3g/YzmBVBLAwQUAAAACAApG1pdYXsvQ4kAAADyAAAACwAAAF9yZWxzLy5yZWxzjc87DgIhEAbgqxAOsLNaWBigstnWeAECwyMujwwY9fZSWKzGwnLmn3x/Rpxx1T2W3EKsjT3Smpvkofd6BGgmYNJtKhXzSFyhpPsYyUPV5qo9wn6eD0BbgyuxNdliJafF7ji7PCv+YxfnosFTMbeEuf+o+LoYsiaPXfJ7IQv2vZ4Gy0EJ+HhRvQBQSwMEFAAAAAgAKRtaXZSXvHWHAAAApgAAABEAAAB3b3JkL2RvY3VtZW50LnhtbEXOwQ0CIRAF0FbIFuBsPHggyEkLQUCWZBnIMAYtwS4sw4PlaB8u68HL+5n8/GRUky7bS/LI4ppmrLLth4m5SIBqJ59M3eTicenOmZLh5aQALZMrlK2vNWJIM2zHcQfJRBy0avKU3a1n6VCH9ef1eD/v4mDYiCOGiN6Tgt50abWs/tbw/0x/AVBLAQIUAxQAAAAIACkbWl1Rl+gEsQAAABQBAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAKRtaXWF7L0OJAAAA8gAAAAsAAAAAAAAAAAAAAIAB4gAAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAKRtaXZSXvHWHAAAApgAAABEAAAAAAAAAAAAAAIABlAEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAAEoCAAAAAA==", "base64")));
  assert.equal(result.text, "张三 Data Engineer");
  assert.equal(result.sourceType, "docx");
});

test("local image OCR recognizes resume text and labels its uncertainty", async () => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(1400, 300); const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1400, 300); ctx.fillStyle = "black"; ctx.font = "55px sans-serif";
  ctx.fillText("Alice Smith", 40, 90); ctx.fillText("Data Engineer Python SQL", 40, 190);
  const result = await extractResume(file("cv.png", canvas.toBuffer("image/png")));
  assert.match(result.text, /Alice Smith/i); assert.match(result.text, /Data Engineer/i);
  assert.ok(result.warnings.some(w => /OCR/.test(w)));
});
test("scanned PDF renders through local OCR", async () => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(1400, 300); const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1400, 300); ctx.fillStyle = "black"; ctx.font = "55px sans-serif";
  ctx.fillText("Alice Smith Data Engineer", 30, 100);
  const doc = new jsPDF(); doc.addImage(canvas.toBuffer("image/png"), "PNG", 10, 10, 185, 40);
  const result = await extractResume(file("scan.pdf", Buffer.from(doc.output("arraybuffer"))));
  assert.match(result.text, /Alice Smith/i); assert.ok(result.warnings.some(w => /OCR/.test(w)));
});
test("rejects malformed RTF group structure", async () => {
  await assert.rejects(extractResume(file("cv.rtf", "{\\rtf1 This is truncated")), IngestionError);
});
test("request limit checks streamed bytes when content-length is absent", async () => {
  const { readBoundedRequest } = await import("../src/lib/ingestion");
  const request = new Request("http://local", { method: "POST", body: "123456" });
  await assert.rejects(readBoundedRequest(request, 5), (e: unknown) => e instanceof IngestionError && e.status === 413);
});
