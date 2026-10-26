import { fromBuffer } from "yauzl";
import type { Readable } from "node:stream";
import { IngestionError } from "./index";

const MAX_EXPANDED_BYTES = 40 * 1024 * 1024;
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 2000;

/** Validate both the directory and actual streamed data before mammoth inflates the archive. */
export function validateDocxArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, archive) => {
      if (error || !archive) { reject(new IngestionError("DOCX 压缩内容损坏，无法读取。")); return; }
      let declaredBytes = 0;
      let expandedBytes = 0;
      let count = 0;
      let hasDocument = false;
      let settled = false;
      let activeStream: Readable | undefined;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        activeStream?.destroy();
        archive.close();
        reject(new IngestionError(message));
      };
      const tooLarge = () => fail("Word 解压后内容过大，请删除无关图片或另存为纯文本。");
      archive.on("error", () => fail("DOCX 文件结构损坏。"));
      archive.on("entry", entry => {
        if (settled) return;
        declaredBytes += entry.uncompressedSize;
        count++;
        if (declaredBytes > MAX_EXPANDED_BYTES || entry.uncompressedSize > MAX_PART_BYTES || count > MAX_ENTRIES) { tooLarge(); return; }
        if (entry.generalPurposeBitFlag & 1) { fail("无法读取加密 Word 文档，请解除密码后重试。"); return; }
        if (entry.fileName === "word/document.xml") hasDocument = true;
        archive.openReadStream(entry, (streamError, stream) => {
          if (settled) { stream?.destroy(); return; }
          if (streamError || !stream) { fail("DOCX 压缩内容损坏，无法读取。"); return; }
          activeStream = stream;
          let partBytes = 0;
          stream.on("error", () => fail("DOCX 解压内容与文件声明不一致，文件可能已损坏。"));
          stream.on("data", (chunk: Buffer) => {
            if (settled) return;
            partBytes += chunk.length;
            expandedBytes += chunk.length;
            if (partBytes > MAX_PART_BYTES || expandedBytes > MAX_EXPANDED_BYTES) { tooLarge(); return; }
            if (partBytes > entry.uncompressedSize) fail("DOCX 解压内容与文件声明不一致，文件可能已损坏。");
          });
          stream.on("end", () => {
            activeStream = undefined;
            if (settled) return;
            if (partBytes !== entry.uncompressedSize) { fail("DOCX 解压内容与文件声明不一致，文件可能已损坏。"); return; }
            // Process one entry at a time; no decompressed content is retained in memory.
            archive.readEntry();
          });
        });
      });
      archive.on("end", () => {
        if (settled) return;
        if (!hasDocument) { fail("文件不是有效的 Word DOCX 文档。"); return; }
        settled = true;
        resolve();
      });
      archive.readEntry();
    });
  });
}
