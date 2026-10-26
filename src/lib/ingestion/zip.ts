import { fromBuffer } from "yauzl";
import { IngestionError } from "./index";

export function validateDocxArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, archive) => {
      if (error || !archive) { reject(new IngestionError("DOCX 压缩内容损坏，无法读取。")); return; }
      let size = 0; let count = 0; let hasDocument = false;
      const fail = (message: string) => { archive.close(); reject(new IngestionError(message)); };
      archive.on("error", () => fail("DOCX 文件结构损坏。"));
      archive.on("entry", entry => {
        size += entry.uncompressedSize; count++;
        if (size > 40 * 1024 * 1024 || count > 2000) { fail("Word 解压后内容过大，请删除无关图片或另存为纯文本。"); return; }
        if (entry.generalPurposeBitFlag & 1) { fail("无法读取加密 Word 文档，请解除密码后重试。"); return; }
        if (entry.fileName === "word/document.xml") hasDocument = true;
        archive.readEntry();
      });
      archive.on("end", () => hasDocument ? resolve() : fail("文件不是有效的 Word DOCX 文档。"));
      archive.readEntry();
    });
  });
}
