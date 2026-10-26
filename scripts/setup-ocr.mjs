import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const revision = "87416418657359cb625c412a48b6e1d6d41c29bd";
const hashes = {
  eng: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
  chi_sim: "a5fcb6f0db1e1d6d8522f39db4e848f05984669172e584e8d76b6b3141e1f730",
};
const directory = process.env.OCR_LANG_PATH || path.resolve("tessdata");
await mkdir(directory, { recursive: true });
for (const [language, hash] of Object.entries(hashes)) {
  const filename = path.join(directory, `${language}.traineddata`);
  let data;
  try { data = await readFile(filename); } catch {}
  const matches = bytes => bytes && createHash("sha256").update(bytes).digest("hex") === hash;
  if (!matches(data)) {
    const response = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/${language}.traineddata`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Could not download ${language}: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (!matches(data)) throw new Error(`OCR data checksum mismatch: ${language}`);
    await writeFile(filename, data);
  }
  console.log(`OCR language ready: ${language}`);
}
